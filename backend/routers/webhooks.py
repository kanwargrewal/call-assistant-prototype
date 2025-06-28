from fastapi import APIRouter, Request, Depends, HTTPException, WebSocket
from fastapi.responses import Response
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy.orm import Session
from database import get_db
from models import PhoneNumber, Business, Call, CallType, CallStatus, ApiConfiguration
from services.twilio_service import twilio_service
from voice_agent import CallRouter, create_voice_agent
import logging
import json
import base64
import asyncio
import ssl
import certifi
import websockets
import openai
from twilio.twiml.voice_response import VoiceResponse as TwilioVoiceResponse, Connect, Stream
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/twilio", tags=["twilio webhooks"])

# Configuration for OpenAI Realtime API
OPENAI_REALTIME_CONFIG = {
    "model": "gpt-4o-realtime-preview-2025-06-03",
    "modalities": ["text", "audio"],
    "voice": "alloy",
    "input_audio_format": "g711_ulaw",
    "output_audio_format": "g711_ulaw",
    "input_audio_transcription": {
        "model": "whisper-1"
    },
    
    "turn_detection": {
        "type": "server_vad",
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "silence_duration_ms": 500
    },
    "temperature": 0.7,
    "max_response_output_tokens": 4096
}


@router.post("/incoming-call")
async def handle_incoming_call(request: Request, db: Session = Depends(get_db)):
    """Handle incoming call webhook from Twilio."""
    try:
        # Parse Twilio webhook data
        form_data = await request.form()
        
        call_sid = form_data.get("CallSid")
        from_number = form_data.get("From")
        to_number = form_data.get("To")
        call_status = form_data.get("CallStatus")
        
        logger.info(f"Incoming call: {call_sid} from {from_number} to {to_number}")
        
        # Find the business phone number
        phone_number = db.query(PhoneNumber).filter(
            PhoneNumber.phone_number == to_number
        ).first()
        
        if not phone_number:
            logger.error(f"Phone number {to_number} not found in database")
            # Return busy signal
            twiml_response = "<Response><Busy/></Response>"
            return Response(content=twiml_response, media_type="application/xml")
        
        business = phone_number.business
        if not business or not business.is_active:
            logger.error(f"Business not found or inactive for phone number {to_number}")
            twiml_response = "<Response><Busy/></Response>"
            return Response(content=twiml_response, media_type="application/xml")
        
        # Create call record
        db_call = Call(
            twilio_call_sid=call_sid,
            business_id=business.id,
            phone_number_id=phone_number.id,
            caller_number=from_number,
            call_type=CallType.AI,  # Start with AI by default
            status=CallStatus.RINGING
        )
        db.add(db_call)
        db.commit()
        
        # For now, route all calls to AI
        # TODO: Implement logic to try reaching business owner first
        logger.info(f"Routing call {call_sid} to AI agent")
        
        # Get OpenAI configuration
        api_config = db.query(ApiConfiguration).filter(
            ApiConfiguration.business_id == business.id,
            ApiConfiguration.is_active == True
        ).first()
        
        if not api_config or not api_config.openai_api_key:
            logger.error(f"No active API configuration found for business {business.id}")
            # Fallback to basic message
            twiml_response = f"""
            <Response>
                <Say>Thank you for calling {business.name}. Unfortunately, no one is available to take your call right now. Please try calling back later or leave a message after the tone.</Say>
                <Record action="/webhooks/twilio/recording-complete" recordingStatusCallback="/webhooks/twilio/recording-status"/>
                <Hangup/>
            </Response>
            """
            return Response(content=twiml_response, media_type="application/xml")
        
        # Create TwiML response with WebSocket connection
        response = TwilioVoiceResponse()
        
        # Establish the WebSocket connection for real-time AI conversation
        host = request.url.hostname
        connect = Connect()
        stream = Stream(url=f'wss://{host}/webhooks/twilio/ai-media-stream')
        
        # Add business and call information to stream parameters
        stream.parameter(name="business_id", value=str(business.id))
        stream.parameter(name="business_name", value=business.name)
        stream.parameter(name="business_description", value=business.description or "")
        stream.parameter(name="call_sid", value=call_sid)
        stream.parameter(name="caller_number", value=from_number)
        stream.parameter(name="openai_api_key", value=api_config.openai_api_key)
        stream.parameter(name="custom_instructions", value=api_config.custom_instructions or "")
        
        connect.append(stream)
        response.append(connect)
        
        return Response(content=str(response), media_type="application/xml")
        
    except Exception as e:
        logger.error(f"Error handling incoming call: {e}")
        # Return error response
        twiml_response = "<Response><Say>Sorry, we're experiencing technical difficulties.</Say><Hangup/></Response>"
        return Response(content=twiml_response, media_type="application/xml")


@router.websocket("/ai-media-stream")
async def handle_ai_media_stream(websocket: WebSocket):
    """Handle WebSocket connections between Twilio and OpenAI for real-time AI conversation."""
    await websocket.accept()
    
    # Create SSL context with proper certificate verification
    ssl_context = ssl.create_default_context()
    ssl_context.load_verify_locations(cafile=certifi.where())
    
    stream_sid = None
    openai_api_key = None
    business_info = {}
    
    try:
        # Wait for the start message (it might not be the first message)
        start_received = False
        while not start_received:
            try:
                message = await websocket.receive_text()
                logger.info(f"Received WebSocket message: {message}")
                data = json.loads(message)
                
                if data.get('event') == 'start':
                    stream_sid = data['start']['streamSid']
                    params = data['start']['customParameters']
                    openai_api_key = params.get('openai_api_key')
                    
                    # Extract business information from stream parameters
                    business_info = {
                        'business_id': params.get('business_id'),
                        'business_name': params.get('business_name'),
                        'business_description': params.get('business_description', ''),
                        'call_sid': params.get('call_sid'),
                        'caller_number': params.get('caller_number'),
                        'custom_instructions': params.get('custom_instructions', '')
                    }
                    
                    if not openai_api_key:
                        logger.error("No OpenAI API key provided in stream parameters")
                        await websocket.close()
                        return
                    
                    start_received = True
                    logger.info(f"Start event received for call: {business_info.get('call_sid')}")
                else:
                    logger.info(f"Received non-start event: {data.get('event')}, waiting for start event...")
                    
            except asyncio.TimeoutError:
                logger.error("Timeout waiting for start event")
                await websocket.close()
                return
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                await websocket.close()
                return
        
        # Now establish OpenAI connection with the correct API key
        async with websockets.connect(
            'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03',
            extra_headers={
                "Authorization": f"Bearer {openai_api_key}",
                "OpenAI-Beta": "realtime=v1"
            },
            ssl=ssl_context
        ) as openai_ws:
            
            async def receive_from_twilio():
                """Receive audio data from Twilio and send it to OpenAI."""
                try:
                    # Start call recording
                    try:
                        host = websocket.url.hostname
                        twilio_service.start_call_recording(
                            call_sid=business_info.get('call_sid'),
                            callback_url=f"https://{host}/webhooks/twilio/recording-status"
                        )
                    except Exception as e:
                        logger.error(f"Failed to start recording: {e}")
                    
                    # Create session with business context
                    await create_ai_session(openai_ws, business_info)
                    
                    # Send initial greeting
                    greeting = f"Hello! Thank you for calling {business_info['business_name']}. I'm your AI assistant, and I'm here to help you while our team is busy. What can I help you with today?"
                    
                    await openai_ws.send(json.dumps({
                        "type": "response.create",
                        "response": {
                            "instructions": f"Say the following greeting: {greeting}"
                        }
                    }))
                    
                    # Continue processing remaining messages
                    async for message in websocket.iter_text():
                        try:
                            message_data = json.loads(message)
                            logger.info(f"Processing message event: {message_data.get('event')}")
                            
                            if message_data['event'] == 'media':
                                # Forward audio data to OpenAI
                                await openai_ws.send(json.dumps({
                                    "type": "input_audio_buffer.append",
                                    "audio": message_data['media']['payload']
                                }))
                                
                            elif message_data['event'] == 'stop':
                                logger.info(f"Call ended: {business_info.get('call_sid')}")
                                # Update call status in database
                                # TODO: Add database session context to update call status
                                # For now, just log the completion
                                break
                                
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse WebSocket message: {e}")
                        except Exception as e:
                            logger.error(f"Error processing message: {e}")
                            
                except WebSocketDisconnect:
                    logger.info("Twilio WebSocket disconnected")
                except Exception as e:
                    logger.error(f"Error in receive_from_twilio: {e}")
            
            async def send_to_twilio():
                """Handle OpenAI responses and send audio back to Twilio."""
                try:
                    async for openai_message in openai_ws:
                        response = json.loads(openai_message)
                        
                        if response['type'] == 'session.created':
                            logger.info("OpenAI session created successfully")
                            
                        elif response['type'] == 'response.audio.delta' and response.get('delta'):
                            # Forward audio response back to Twilio
                            try:
                                audio_payload = base64.b64encode(base64.b64decode(response['delta'])).decode('utf-8')
                                await websocket.send_json({
                                    "event": "media",
                                    "streamSid": stream_sid,
                                    "media": {
                                        "payload": audio_payload
                                    }
                                })
                            except Exception as e:
                                logger.error(f"Error processing audio data: {e}")
                                
                        elif response['type'] == 'conversation.item.input_audio_transcription.completed':
                            # Log user's transcribed speech for monitoring
                            transcript = response.get('transcript', '')
                            logger.info(f"User said: {transcript}")
                            
                        elif response['type'] == 'response.done':
                            # Log AI response completion
                            logger.info("AI response completed")
                            
                        elif response['type'] == 'error':
                            logger.error(f"OpenAI error: {response}")
                            
                except Exception as e:
                    logger.error(f"Error in send_to_twilio: {e}")
            
            # Start both coroutines
            await asyncio.gather(receive_from_twilio(), send_to_twilio())
            
    except Exception as e:
        logger.error(f"Error in WebSocket connection: {e}")
        # Send error message to caller
        try:
            if stream_sid:
                await websocket.send_json({
                    "event": "media",
                    "streamSid": stream_sid,
                    "media": {
                        "payload": base64.b64encode("I'm sorry, I'm experiencing technical difficulties.".encode()).decode('utf-8')
                    }
                })
        except:
            pass
        raise


async def create_ai_session(openai_ws, business_info: dict):
    """Create OpenAI session with business context."""
    try:
        # Create system prompt with business information
        system_prompt = f"""You are a helpful AI assistant for {business_info['business_name']}. 

Business Information:
- Name: {business_info['business_name']}
- Description: {business_info['business_description']}

Your role:
- You are answering customer calls when the business is busy
- Be professional, friendly, and helpful
- Provide information about the business services
- If you don't know something specific, offer to take a message or have someone call back
- Keep responses natural and conversational for phone conversation
- Always try to be helpful and positive
- You can help with general inquiries, take messages, provide business hours, and basic information

Additional Instructions:
{business_info['custom_instructions']}

Guidelines for phone conversations:
- Speak naturally and conversationally
- Don't be overly verbose - keep responses concise but helpful
- Ask clarifying questions when needed
- If you can't help with something specific, offer alternatives like taking a message
- Be empathetic and understanding
- Thank the caller for their patience since the business is currently busy"""

        # Send session update to OpenAI
        session_update = {
            "type": "session.update",
            "session": {
                **OPENAI_REALTIME_CONFIG,
                "instructions": system_prompt
            }
        }
        
        await openai_ws.send(json.dumps(session_update))
        logger.info("OpenAI session configured with business context")
        
    except Exception as e:
        logger.error(f"Error creating AI session: {e}")


@router.post("/call-status")
async def handle_call_status(request: Request, db: Session = Depends(get_db)):
    """Handle call status updates from Twilio."""
    try:
        form_data = await request.form()
        
        call_sid = form_data.get("CallSid")
        call_status = form_data.get("CallStatus")
        call_duration = form_data.get("CallDuration")
        call_price = form_data.get("CallPrice")
        
        logger.info(f"Call status update: {call_sid} - {call_status}")
        
        # Find the call in database
        call = db.query(Call).filter(Call.twilio_call_sid == call_sid).first()
        if not call:
            logger.warning(f"Call {call_sid} not found in database")
            return Response(status_code=200)
        
        # Update call status
        if call_status == "completed":
            call.status = CallStatus.COMPLETED
            call.duration_seconds = int(call_duration) if call_duration else None
            call.cost = float(call_price) if call_price else None
        elif call_status == "busy":
            call.status = CallStatus.FAILED
        elif call_status == "no-answer":
            call.status = CallStatus.NO_ANSWER
        elif call_status == "in-progress":
            call.status = CallStatus.IN_PROGRESS
        
        db.commit()
        
        return Response(status_code=200)
        
    except Exception as e:
        logger.error(f"Error handling call status: {e}")
        return Response(status_code=500)


@router.post("/recording-complete")
async def handle_recording_complete(request: Request, db: Session = Depends(get_db)):
    """Handle recording completion webhook from Twilio."""
    try:
        form_data = await request.form()
        
        call_sid = form_data.get("CallSid")
        recording_url = form_data.get("RecordingUrl")
        recording_sid = form_data.get("RecordingSid")
        recording_duration = form_data.get("RecordingDuration")
        
        logger.info(f"Recording complete: {call_sid} - {recording_sid}")
        
        # Find the call in database
        call = db.query(Call).filter(Call.twilio_call_sid == call_sid).first()
        if not call:
            logger.warning(f"Call {call_sid} not found in database")
            return Response(status_code=200)
        
        # Update call with recording information
        call.recording_url = recording_url
        call.recording_sid = recording_sid
        
        # If duration wasn't set from call status, try to get it from recording
        if not call.duration_seconds and recording_duration:
            call.duration_seconds = int(recording_duration)
        
        db.commit()
        
        # TODO: Here you could trigger AI analysis of the recording
        # to generate call summary and extract insights
        
        return Response(status_code=200)
        
    except Exception as e:
        logger.error(f"Error handling recording complete: {e}")
        return Response(status_code=500)


@router.post("/recording-status")
async def handle_recording_status(request: Request):
    """Handle recording status updates from Twilio."""
    try:
        form_data = await request.form()
        
        recording_sid = form_data.get("RecordingSid")
        recording_status = form_data.get("RecordingStatus")
        
        logger.info(f"Recording status: {recording_sid} - {recording_status}")
        
        # Log the status for monitoring
        # In production, you might want to update database status
        
        return Response(status_code=200)
        
    except Exception as e:
        logger.error(f"Error handling recording status: {e}")
        return Response(status_code=500)


# The ai-response endpoint has been replaced with real-time WebSocket streaming


@router.post("/ai-handoff")
async def handle_ai_handoff(request: Request, db: Session = Depends(get_db)):
    """Handle handoff from human to AI agent."""
    try:
        form_data = await request.form()
        
        call_sid = form_data.get("CallSid")
        
        logger.info(f"AI handoff request for call: {call_sid}")
        
        # Find the call in database
        call = db.query(Call).filter(Call.twilio_call_sid == call_sid).first()
        if not call:
            logger.warning(f"Call {call_sid} not found in database")
            return Response(status_code=404)
        
        # Update call type to AI
        call.call_type = CallType.AI
        db.commit()
        
        # Get business and API configuration
        business = call.business
        api_config = db.query(ApiConfiguration).filter(
            ApiConfiguration.business_id == business.id,
            ApiConfiguration.is_active == True
        ).first()
        
        if not api_config:
            logger.error(f"No active API configuration found for business {business.id}")
            twiml_response = """
            <Response>
                <Say>I'm sorry, but I cannot transfer you to our AI assistant right now.</Say>
                <Hangup/>
            </Response>
            """
            return Response(content=twiml_response, media_type="application/xml")
        
        # Create WebSocket URL for AI agent
        websocket_url = f"wss://your-domain.com/ws/voice-agent/{call_sid}"
        
        # Generate TwiML for AI agent
        twiml_response = twilio_service.create_ai_agent_twiml(websocket_url, record_call=False)
        
        return Response(content=twiml_response, media_type="application/xml")
        
    except Exception as e:
        logger.error(f"Error handling AI handoff: {e}")
        return Response(status_code=500) 