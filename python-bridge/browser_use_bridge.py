#!/usr/bin/env python3
"""
Browser Use Bridge Script

Purpose: This script serves as a bridge between the Node.js/Electron application
and the Python browser-use library. It provides AI-powered browser automation
capabilities with intelligent cookie handling and natural web interactions.

The script communicates with the Node.js application via JSON messages over
stdin/stdout, allowing seamless integration of browser-use's AI capabilities
into the Electron application.

Features:
- AI-powered web automation using browser-use
- Intelligent cookie consent handling
- Natural human-like interactions
- JSON-based communication protocol
- Comprehensive error handling and logging
"""

import asyncio
import json
import sys
import os
import logging
from typing import Dict, Any, List
from datetime import datetime

# Fix Windows Unicode encoding issues
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())
    # Set console encoding to UTF-8
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Add the current directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from browser_use import Agent
    from browser_use.llm import ChatOpenAI
    import dotenv
    dotenv.load_dotenv()
except ImportError as e:
    print(json.dumps({
        "type": "error",
        "message": f"Failed to import browser-use: {e}",
        "timestamp": datetime.now().isoformat()
    }))
    sys.exit(1)

# Configure logging with Unicode support
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('browser_use_bridge.log', encoding='utf-8'),
        logging.StreamHandler(sys.stderr)
    ]
)

# Set up Unicode-safe logging formatter
class UnicodeFormatter(logging.Formatter):
    def format(self, record):
        try:
            return super().format(record)
        except UnicodeEncodeError:
            # Replace problematic Unicode characters
            record.msg = str(record.msg).encode('ascii', 'replace').decode('ascii')
            return super().format(record)

# Apply Unicode formatter to all handlers
for handler in logging.getLogger().handlers:
    handler.setFormatter(UnicodeFormatter('%(asctime)s - %(levelname)s - %(message)s'))
logger = logging.getLogger(__name__)

class BrowserUseBridge:
    """
    Bridge class that handles communication between Node.js and browser-use
    """
    
    def __init__(self):
        self.agent = None
        self.llm = None
        self.initialize_llm()
    
    def initialize_llm(self):
        """Initialize the LLM for browser-use"""
        try:
            # Try to use OpenAI first, fallback to other providers
            api_key = os.getenv('OPENAI_API_KEY')
            if api_key:
                self.llm = ChatOpenAI(
                    model="gpt-4o-mini",
                    temperature=0.1,
                    api_key=api_key
                )
                logger.info("Initialized OpenAI LLM")
            else:
                # Try other providers
                anthropic_key = os.getenv('ANTHROPIC_API_KEY')
                if anthropic_key:
                    from browser_use.llm import ChatAnthropic
                    self.llm = ChatAnthropic(
                        model="claude-3-sonnet-20240229",
                        api_key=anthropic_key
                    )
                    logger.info("Initialized Anthropic LLM")
                else:
                    raise Exception("No API key found. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY")
                    
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {e}")
            self.send_response({
                "type": "error",
                "message": f"Failed to initialize LLM: {e}"
            })
    
    def send_response(self, response: Dict[str, Any]):
        """Send JSON response to Node.js"""
        try:
            response["timestamp"] = datetime.now().isoformat()
            print(json.dumps(response), flush=True)
        except Exception as e:
            logger.error(f"Failed to send response: {e}")
    
    async def execute_task(self, task_data: Dict[str, Any]):
        """Execute a browser automation task using browser-use with timeout handling"""
        try:
            task_description = task_data.get('task', '')
            url = task_data.get('url', '')
            timeout = task_data.get('timeout', 60)
            
            if not task_description:
                raise ValueError("Task description is required")
            
            # Create enhanced task description
            enhanced_task = self.enhance_task_description(task_description, url)
            
            logger.info(f"Executing task with {timeout}s timeout")
            logger.info(f"Task preview: {enhanced_task[:300]}...")
            
            # Create agent with balanced settings
            self.agent = Agent(
                task=enhanced_task,
                llm=self.llm,
                max_actions=12,  # Increased for complex tasks
                timeout=min(timeout, 90)  # Increased timeout for complex searches
            )
            
            logger.info("Agent created successfully, starting execution...")
            
            # Execute the task with timeout wrapper
            try:
                # Use the exact timeout provided, with a reasonable maximum
                actual_timeout = min(timeout, 90)  # Cap at 90 seconds
                
                result = await asyncio.wait_for(
                    self.agent.run(), 
                    timeout=actual_timeout
                )
                
                # Process and return results
                processed_result = self.process_result(result)
                
                self.send_response({
                    "type": "success",
                    "data": processed_result
                })
                
            except asyncio.TimeoutError:
                logger.warning(f"Task timed out after {actual_timeout} seconds")
                self.send_response({
                    "type": "error",
                    "message": f"Task timed out after {actual_timeout} seconds. Site may have bot detection or be unresponsive."
                })
            
        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            
            # Check if it's a bot detection related error
            error_msg = str(e).lower()
            if any(keyword in error_msg for keyword in ['captcha', 'bot', 'verification', 'challenge', 'blocked']):
                self.send_response({
                    "type": "error",
                    "message": f"Bot detection encountered: {str(e)}"
                })
            else:
                self.send_response({
                    "type": "error",
                    "message": str(e)
                })
    
    def enhance_task_description(self, task: str, url: str = "") -> str:
        """Enhance the task description with specific instructions for better automation"""
        enhanced_task = task
        
        # Add URL navigation if provided
        if url:
            enhanced_task = f"Navigate to {url} and then complete this task:\n\n{task}"
        
        # Add comprehensive instructions for better automation
        enhanced_task += "\n\nACTION-FOCUSED RULES:"
        enhanced_task += "\n- TAKE IMMEDIATE ACTION - don't spend time analyzing"
        enhanced_task += "\n- Click Accept on any cookie popups (5 seconds max)"
        enhanced_task += "\n- Find form fields quickly by their labels"
        enhanced_task += "\n- Type airport codes immediately when you find the right field"
        enhanced_task += "\n- Click dropdown options immediately when they appear"
        enhanced_task += "\n- If stuck on any element for >10 seconds, move to next step"
        enhanced_task += "\n- If you see bot detection/CAPTCHA, stop immediately"
        enhanced_task += "\n- SPEED IS CRITICAL - don't overthink, just execute"
        
        return enhanced_task
    
    def process_result(self, result) -> Dict[str, Any]:
        """Process browser-use result into a format suitable for Node.js"""
        try:
            processed = {
                "success": True,
                "actions_taken": [],
                "final_state": {},
                "screenshots": [],
                "extracted_data": []
            }
            
            # Extract information from browser-use result
            if hasattr(result, 'actions'):
                processed["actions_taken"] = [str(action) for action in result.actions]
            
            if hasattr(result, 'final_url'):
                processed["final_state"]["url"] = result.final_url
            
            if hasattr(result, 'screenshots'):
                processed["screenshots"] = result.screenshots
            
            # Add any extracted text or data
            if hasattr(result, 'extracted_content'):
                processed["extracted_data"] = result.extracted_content
            
            return processed
            
        except Exception as e:
            logger.error(f"Failed to process result: {e}")
            return {
                "success": False,
                "error": str(e),
                "raw_result": str(result)
            }
    
    async def test_connection(self):
        """Test the browser-use setup"""
        try:
            logger.info("Testing browser-use connection...")
            
            # Simple test - just verify LLM is working
            if not self.llm:
                raise Exception("LLM not initialized")
            
            # Test LLM connection
            test_response = await self.llm.ainvoke([{"role": "user", "content": "Say 'test successful'"}])
            logger.info("LLM test successful")
            
            self.send_response({
                "type": "test_success",
                "message": "Browser-use is working correctly"
            })
            
        except Exception as e:
            logger.error(f"Test failed: {e}")
            self.send_response({
                "type": "test_error",
                "message": f"Browser-use test failed: {e}"
            })
    
    async def handle_message(self, message: Dict[str, Any]):
        """Handle incoming messages from Node.js"""
        try:
            message_type = message.get('type', '')
            
            if message_type == 'execute_task':
                await self.execute_task(message.get('data', {}))
            elif message_type == 'test':
                await self.test_connection()
            elif message_type == 'ping':
                self.send_response({"type": "pong", "message": "Bridge is alive"})
            else:
                self.send_response({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })
                
        except Exception as e:
            logger.error(f"Message handling failed: {e}")
            self.send_response({
                "type": "error",
                "message": f"Message handling failed: {e}"
            })
    
    async def run(self):
        """Main loop to handle messages from Node.js"""
        logger.info("Browser-use bridge started")
        
        # Send ready signal
        self.send_response({
            "type": "ready",
            "message": "Browser-use bridge is ready"
        })
        
        try:
            # Read messages from stdin
            while True:
                try:
                    line = input()
                    if not line.strip():
                        continue
                    
                    message = json.loads(line)
                    await self.handle_message(message)
                    
                except EOFError:
                    logger.info("Input stream closed, exiting")
                    break
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received: {e}")
                    self.send_response({
                        "type": "error",
                        "message": f"Invalid JSON: {e}"
                    })
                except Exception as e:
                    logger.error(f"Unexpected error: {e}")
                    self.send_response({
                        "type": "error",
                        "message": f"Unexpected error: {e}"
                    })
                    
        except KeyboardInterrupt:
            logger.info("Bridge interrupted by user")
        except Exception as e:
            logger.error(f"Bridge crashed: {e}")
        finally:
            logger.info("Browser-use bridge shutting down")

async def main():
    """Main entry point"""
    bridge = BrowserUseBridge()
    await bridge.run()

if __name__ == "__main__":
    asyncio.run(main())