from twilio.rest import Client
from twilio.twiml import TwiML
from typing import List, Optional, Dict
from config import settings
import logging

logger = logging.getLogger(__name__)


class TwilioService:
    def __init__(self):
        self.client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    
    def search_available_numbers(self, area_code: str, country: str = "US") -> List[Dict]:
        """
        Search for available phone numbers in a specific area code.
        
        Args:
            area_code: The area code to search in (e.g., "212")
            country: Country code ("US" or "CA")
            
        Returns:
            List of available phone numbers with their details
        """
        logger.info(f"Starting phone number search - Area code: {area_code}, Country: {country}")
        
        try:
            if country == "CA":
                logger.info(f"Searching Canadian phone numbers in area code {area_code}")
                numbers = self.client.available_phone_numbers("CA").local.list(
                    area_code=int(area_code),
                    limit=10
                )
            else:
                logger.info(f"Searching US phone numbers in area code {area_code}")
                numbers = self.client.available_phone_numbers("US").local.list(
                    area_code=int(area_code),
                    limit=10
                )
            
            logger.info(f"Twilio returned {len(numbers)} available numbers for area code {area_code} in {country}")
            
            result = [
                {
                    "phone_number": number.phone_number,
                    "friendly_name": number.friendly_name,
                    "locality": number.locality,
                    "region": number.region,
                    "capabilities": {
                        "voice": number.capabilities.get("voice", False),
                        "sms": number.capabilities.get("sms", False),
                    }
                }
                for number in numbers
            ]
            
            if result:
                logger.info(f"Successfully formatted {len(result)} phone numbers for return")
                logger.debug(f"Available numbers: {[num['phone_number'] for num in result]}")
            else:
                logger.warning(f"No phone numbers available for area code {area_code} in {country}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error searching for numbers in area code {area_code}, country {country}: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            return []
    
    def purchase_phone_number(self, phone_number: str, webhook_url: str) -> Optional[str]:
        """
        Purchase a phone number and configure it with webhooks.
        
        Args:
            phone_number: The phone number to purchase (e.g., "+1234567890")
            webhook_url: URL for incoming call webhooks
            
        Returns:
            Twilio SID of the purchased number, or None if failed
        """
        try:
            logger.info(f"Attempting to purchase phone number: {phone_number}")
            logger.info(f"Webhook URL: {webhook_url}")
            
            # Configure webhooks for incoming calls
            number = self.client.incoming_phone_numbers.create(
                phone_number=phone_number,
                voice_url=webhook_url,
                voice_method="POST",
                status_callback=f"{webhook_url}/status",
                status_callback_method="POST"
            )
            
            logger.info(f"Successfully purchased phone number: {phone_number}")
            logger.info(f"Twilio SID: {number.sid}")
            logger.info(f"Voice URL set to: {number.voice_url}")
            logger.info(f"Status callback set to: {number.status_callback}")
            
            # Verify the number was actually created
            try:
                verification = self.client.incoming_phone_numbers(number.sid).fetch()
                logger.info(f"Verification successful - Number exists in Twilio: {verification.phone_number}")
                return number.sid
            except Exception as verify_error:
                logger.error(f"Failed to verify purchased number: {verify_error}")
                return number.sid  # Return SID anyway since purchase seemed successful
                
        except Exception as e:
            logger.error(f"Error purchasing phone number {phone_number}: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Error details: {str(e)}")
            return None
    
    def verify_phone_number_exists(self, phone_number_sid: str) -> bool:
        """
        Verify if a phone number exists in Twilio account.
        
        Args:
            phone_number_sid: Twilio SID of the phone number
            
        Returns:
            True if number exists, False otherwise
        """
        try:
            number = self.client.incoming_phone_numbers(phone_number_sid).fetch()
            logger.info(f"Phone number verified: {number.phone_number} (SID: {phone_number_sid})")
            return True
        except Exception as e:
            logger.error(f"Phone number {phone_number_sid} not found in Twilio: {e}")
            return False
    
    def release_phone_number(self, phone_number_sid: str) -> bool:
        """
        Release a phone number back to Twilio.
        
        Args:
            phone_number_sid: Twilio SID of the phone number
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.client.incoming_phone_numbers(phone_number_sid).delete()
            logger.info(f"Successfully released phone number: {phone_number_sid}")
            return True
        except Exception as e:
            logger.error(f"Error releasing phone number {phone_number_sid}: {e}")
            return False
    
    def create_call_redirect_twiml(self, business_owner_phone: str, record_call: bool = True) -> str:
        """
        Create TwiML to redirect call to business owner.
        
        Args:
            business_owner_phone: Phone number of business owner
            record_call: Whether to record the call
            
        Returns:
            TwiML response as string
        """
        twiml = TwiML()
        
        # Add call recording if enabled
        if record_call:
            twiml.record(
                action="/webhooks/twilio/recording-complete",
                method="POST",
                recording_status_callback="/webhooks/twilio/recording-status"
            )
        
        # Dial the business owner
        dial = twiml.dial(
            action="/webhooks/twilio/call-status",
            method="POST",
            timeout=30,
            caller_id=None  # Use the purchased number as caller ID
        )
        dial.number(business_owner_phone)
        
        return str(twiml)
    
    def create_ai_agent_twiml(self, websocket_url: str, record_call: bool = True) -> str:
        """
        Create TwiML to connect call to AI agent via WebSocket.
        
        Args:
            websocket_url: WebSocket URL for AI agent connection
            record_call: Whether to record the call
            
        Returns:
            TwiML response as string
        """
        twiml = TwiML()
        
        # Add call recording if enabled
        if record_call:
            twiml.record(
                action="/webhooks/twilio/recording-complete",
                method="POST",
                recording_status_callback="/webhooks/twilio/recording-status"
            )
        
        # Connect to AI agent via WebSocket
        twiml.connect().stream(url=websocket_url)
        
        return str(twiml)
    
    def initiate_outbound_call(self, to_number: str, from_number: str, twiml_url: str) -> Optional[str]:
        """
        Initiate an outbound call.
        
        Args:
            to_number: Number to call
            from_number: Twilio number to call from
            twiml_url: URL containing TwiML instructions
            
        Returns:
            Call SID if successful, None otherwise
        """
        try:
            call = self.client.calls.create(
                to=to_number,
                from_=from_number,
                url=twiml_url,
                method="POST",
                status_callback="/webhooks/twilio/call-status",
                status_callback_events=["initiated", "ringing", "answered", "completed"],
                status_callback_method="POST"
            )
            logger.info(f"Successfully initiated call: {call.sid}")
            return call.sid
        except Exception as e:
            logger.error(f"Error initiating call: {e}")
            return None
    
    def get_call_details(self, call_sid: str) -> Optional[Dict]:
        """
        Get details of a specific call.
        
        Args:
            call_sid: Twilio call SID
            
        Returns:
            Call details dictionary or None if not found
        """
        try:
            call = self.client.calls(call_sid).fetch()
            return {
                "sid": call.sid,
                "status": call.status,
                "duration": call.duration,
                "start_time": call.start_time,
                "end_time": call.end_time,
                "from": call.from_,
                "to": call.to,
                "price": call.price,
                "price_unit": call.price_unit,
            }
        except Exception as e:
            logger.error(f"Error fetching call details: {e}")
            return None
    
    def get_recording_url(self, recording_sid: str) -> Optional[str]:
        """
        Get the URL of a call recording.
        
        Args:
            recording_sid: Twilio recording SID
            
        Returns:
            Recording URL or None if not found
        """
        try:
            recording = self.client.recordings(recording_sid).fetch()
            # Construct the full URL
            base_url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}"
            return f"{base_url}/Recordings/{recording.sid}.mp3"
        except Exception as e:
            logger.error(f"Error fetching recording URL: {e}")
            return None
    
    def list_twilio_phone_numbers(self) -> List[Dict]:
        """
        List all phone numbers in the Twilio account for debugging.
        
        Returns:
            List of phone number details
        """
        try:
            numbers = self.client.incoming_phone_numbers.list()
            result = []
            for number in numbers:
                result.append({
                    "sid": number.sid,
                    "phone_number": number.phone_number,
                    "friendly_name": number.friendly_name,
                    "voice_url": number.voice_url,
                    "status_callback": number.status_callback,
                    "date_created": number.date_created,
                })
            logger.info(f"Found {len(result)} phone numbers in Twilio account")
            return result
        except Exception as e:
            logger.error(f"Error listing Twilio phone numbers: {e}")
            return []


# Global instance
twilio_service = TwilioService() 