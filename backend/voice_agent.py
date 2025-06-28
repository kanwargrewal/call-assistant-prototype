import asyncio
import json
import websockets
import logging
from typing import Optional, Dict, Any, List, Callable
from openai import AsyncOpenAI
from database import SessionLocal
from models import Call, Business, PhoneNumber, ApiConfiguration

logger = logging.getLogger(__name__)

class VoiceAgent:
    """
    Voice agent implementation using OpenAI's Realtime API via WebSockets
    """
    
    def __init__(self, api_key: str, instructions: str = None):
        self.api_key = api_key
        self.instructions = instructions or "You are a helpful assistant."
        self.websocket = None
        self.session_id = None
        
    async def connect(self):
        """Connect to OpenAI Realtime API"""
        url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "OpenAI-Beta": "realtime=v1"
        }
        
        try:
            self.websocket = await websockets.connect(url, extra_headers=headers)
            logger.info("Connected to OpenAI Realtime API")
            
            # Send session configuration
            await self.send_session_update()
            return True
        except Exception as e:
            logger.error(f"Failed to connect to OpenAI Realtime API: {e}")
            return False
    
    async def send_session_update(self):
        """Send session configuration to set up the voice agent"""
        session_config = {
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": self.instructions,
                "voice": "alloy",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": "whisper-1"
                },
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 200
                }
            }
        }
        
        await self.websocket.send(json.dumps(session_config))
        logger.info("Sent session configuration")
    
    async def send_audio(self, audio_data: bytes):
        """Send audio data to the voice agent"""
        if not self.websocket:
            raise Exception("Not connected to Realtime API")
        
        # Convert bytes to base64
        import base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        audio_message = {
            "type": "input_audio_buffer.append",
            "audio": audio_base64
        }
        
        await self.websocket.send(json.dumps(audio_message))
    
    async def commit_audio(self):
        """Commit the audio buffer and trigger response generation"""
        if not self.websocket:
            raise Exception("Not connected to Realtime API")
        
        commit_message = {"type": "input_audio_buffer.commit"}
        await self.websocket.send(json.dumps(commit_message))
        
        response_message = {"type": "response.create"}
        await self.websocket.send(json.dumps(response_message))
    
    async def listen_for_responses(self, audio_callback: Callable[[bytes], None] = None):
        """Listen for responses from the voice agent"""
        if not self.websocket:
            raise Exception("Not connected to Realtime API")
        
        try:
            async for message in self.websocket:
                data = json.loads(message)
                event_type = data.get("type")
                
                if event_type == "session.created":
                    self.session_id = data.get("session", {}).get("id")
                    logger.info(f"Session created: {self.session_id}")
                
                elif event_type == "response.audio.delta":
                    # Handle audio response
                    if audio_callback and "delta" in data:
                        import base64
                        audio_data = base64.b64decode(data["delta"])
                        audio_callback(audio_data)
                
                elif event_type == "response.text.delta":
                    # Handle text response
                    if "delta" in data:
                        logger.info(f"Assistant text: {data['delta']}")
                
                elif event_type == "error":
                    logger.error(f"Realtime API error: {data}")
                
                elif event_type == "response.done":
                    logger.info("Response complete")
                    break
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
        except Exception as e:
            logger.error(f"Error listening for responses: {e}")
    
    async def disconnect(self):
        """Disconnect from the Realtime API"""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            logger.info("Disconnected from OpenAI Realtime API")


class CallRouter:
    """
    Handles call routing between business owners and AI agents
    """
    
    def __init__(self):
        self.db = SessionLocal()
    
    async def route_call(self, phone_number: str, caller_number: str) -> Dict[str, Any]:
        """
        Route an incoming call to the appropriate handler
        """
        try:
            # Find the phone number in database
            phone_record = self.db.query(PhoneNumber).filter(
                PhoneNumber.number == phone_number
            ).first()
            
            if not phone_record:
                logger.error(f"Phone number {phone_number} not found")
                return {"action": "hangup", "reason": "number_not_found"}
            
            # Get business and API configuration
            business = phone_record.business
            api_config = self.db.query(ApiConfiguration).filter(
                ApiConfiguration.business_id == business.id
            ).first()
            
            if not api_config or not api_config.openai_api_key:
                logger.error(f"No OpenAI API key configured for business {business.name}")
                return {"action": "hangup", "reason": "no_api_key"}
            
            # Create call record
            call = Call(
                phone_number_id=phone_record.id,
                caller_number=caller_number,
                call_type="ai",  # Start with AI, can be updated if human answers
                status="in_progress"
            )
            self.db.add(call)
            self.db.commit()
            
            # Try to reach business owner first (this would be implemented with actual calling logic)
            owner_available = await self.try_reach_owner(business)
            
            if owner_available:
                call.call_type = "human"
                self.db.commit()
                return {
                    "action": "connect_to_owner",
                    "call_id": call.id,
                    "business": business.name
                }
            else:
                # Fall back to AI agent
                voice_agent = await self.create_voice_agent(business, api_config)
                return {
                    "action": "connect_to_ai",
                    "call_id": call.id,
                    "voice_agent": voice_agent,
                    "business": business.name
                }
                
        except Exception as e:
            logger.error(f"Error routing call: {e}")
            return {"action": "hangup", "reason": "internal_error"}
        finally:
            self.db.close()
    
    async def try_reach_owner(self, business: Business) -> bool:
        """
        Try to reach the business owner (placeholder implementation)
        In a real implementation, this would make an actual phone call
        """
        # This is a placeholder - in reality you would:
        # 1. Call the business owner's phone number
        # 2. Wait for answer with timeout
        # 3. Return True if answered, False if no answer
        
        logger.info(f"Attempting to reach owner of {business.name}")
        # Simulate no answer for now
        return False
    
    async def create_voice_agent(self, business: Business, api_config: ApiConfiguration) -> VoiceAgent:
        """
        Create and configure a voice agent for the business
        """
        instructions = f"""
        You are a helpful AI assistant for {business.name}. 
        You are answering customer calls on behalf of the business owner.
        Be polite, professional, and helpful.
        If you cannot help with something, offer to take a message for the owner.
        Keep responses concise and natural for voice conversation.
        """
        
        if api_config.custom_instructions:
            instructions += f"\n\nAdditional instructions: {api_config.custom_instructions}"
        
        voice_agent = VoiceAgent(
            api_key=api_config.openai_api_key,
            instructions=instructions
        )
        
        # Connect to the Realtime API
        connected = await voice_agent.connect()
        if not connected:
            raise Exception("Failed to connect voice agent to OpenAI Realtime API")
        
        return voice_agent


def create_voice_agent(api_key: str, instructions: str = None) -> VoiceAgent:
    """
    Factory function to create a voice agent
    """
    return VoiceAgent(api_key=api_key, instructions=instructions) 