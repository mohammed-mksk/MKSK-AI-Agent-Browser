"""
Enhanced Browser Automation with Dynamic Field Detection
Created: July 30, 2025

Replaces hardcoded selectors with intelligent field discovery
Integrates with JavaScript field detection engine
"""

import asyncio
import json
from typing import Dict, List, Optional, Any
from playwright.async_api import Page, Browser
import logging

logger = logging.getLogger(__name__)

class EnhancedBrowserAutomation:
    def __init__(self):
        self.detected_fields = []
        self.field_mappings = {}
        self.detection_enabled = True
        
    async def detect_and_highlight_fields(self, page: Page) -> List[Dict]:
        """Detect all fields on the page and highlight them"""
        
        try:
            # Inject field detection scripts
            await self.inject_field_detection_scripts(page)
            
            # Detect fields using the enhanced system
            detected_fields = await page.evaluate("""
                async () => {
                    if (!window.DynamicFieldDetector || !window.FieldHighlighter) {
                        throw new Error('Field detection scripts not loaded');
                    }
                    
                    const detector = new window.DynamicFieldDetector();
                    const highlighter = new window.FieldHighlighter();
                    
                    const fields = await detector.detectAllFields();
                    highlighter.highlightFields(fields);
                    
                    // Return serializable field data
                    return fields.map(field => ({
                        id: field.id,
                        semantic: field.semantic,
                        score: field.score,
                        attributes: field.attributes,
                        context: field.context,
                        rect: {
                            x: field.rect.x,
                            y: field.rect.y,
                            width: field.rect.width,
                            height: field.rect.height
                        }
                    }));
                }
            """)
            
            self.detected_fields = detected_fields
            logger.info(f"Detected {len(detected_fields)} fields on page")
            return detected_fields
            
        except Exception as e:
            logger.error(f"Field detection failed: {e}")
            return []
    
    async def inject_field_detection_scripts(self, page: Page):
        """Inject the field detection and highlighting JavaScript"""
        
        try:
            # Field Detection Script
            field_detection_script = """
            class DynamicFieldDetector {
                constructor() {
                    this.fieldSelectors = [
                        'input[type="text"]', 'input[type="email"]', 'input[type="password"]',
                        'input[type="tel"]', 'input[type="search"]', 'input[type="url"]',
                        'input[type="number"]', 'input[type="date"]', 'input:not([type])',
                        'textarea', 'select', '[contenteditable="true"]'
                    ];
                    this.semanticPatterns = {
                        email: [/email/i, /e-mail/i, /mail/i],
                        password: [/password/i, /pass/i, /pwd/i],
                        name: [/name/i, /firstname/i, /lastname/i],
                        departure: [/from/i, /departure/i, /origin/i, /depart/i],
                        destination: [/to/i, /destination/i, /arrival/i, /arrive/i],
                        date: [/date/i, /when/i, /departure/i],
                        phone: [/phone/i, /tel/i, /mobile/i],
                        address: [/address/i, /street/i, /city/i]
                    };
                }
                
                async detectAllFields() {
                    const fields = [];
                    let counter = 0;
                    
                    for (const selector of this.fieldSelectors) {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(element => {
                            if (this.isVisible(element)) {
                                const field = this.analyzeField(element, counter++);
                                if (field) fields.push(field);
                            }
                        });
                    }
                    
                    return this.rankFields(fields);
                }
                
                isVisible(element) {
                    const rect = element.getBoundingClientRect();
                    const style = window.getComputedStyle(element);
                    return rect.width > 0 && rect.height > 0 && 
                           style.display !== 'none' && style.visibility !== 'hidden';
                }
                
                analyzeField(element, order) {
                    const rect = element.getBoundingClientRect();
                    const attributes = this.extractAttributes(element);
                    const context = this.analyzeContext(element);
                    const semantic = this.inferPurpose(element, attributes, context);
                    const score = this.calculateScore(attributes, context, semantic);
                    
                    return {
                        id: `field_${order}_${Date.now()}`,
                        element,
                        rect,
                        attributes,
                        context,
                        semantic,
                        score,
                        visible: true
                    };
                }
                
                extractAttributes(element) {
                    return {
                        name: element.name || undefined,
                        id: element.id || undefined,
                        type: element.type || element.tagName.toLowerCase(),
                        placeholder: element.placeholder || undefined,
                        className: element.className || undefined
                    };
                }
                
                analyzeContext(element) {
                    return {
                        label: this.findLabel(element),
                        nearbyText: this.getNearbyText(element)
                    };
                }
                
                findLabel(element) {
                    if (element.id) {
                        const label = document.querySelector(`label[for="${element.id}"]`);
                        if (label) return label.textContent.trim();
                    }
                    const parentLabel = element.closest('label');
                    if (parentLabel) return parentLabel.textContent.trim();
                    return undefined;
                }
                
                getNearbyText(element) {
                    const texts = [];
                    const parent = element.parentElement;
                    if (parent) {
                        const textNodes = parent.querySelectorAll('*');
                        textNodes.forEach(node => {
                            if (node !== element && node.textContent.trim()) {
                                texts.push(node.textContent.trim());
                            }
                        });
                    }
                    return texts;
                }
                
                inferPurpose(element, attributes, context) {
                    const searchText = [
                        attributes.name, attributes.id, attributes.placeholder,
                        context.label, ...context.nearbyText
                    ].filter(Boolean).join(' ').toLowerCase();
                    
                    for (const [semantic, patterns] of Object.entries(this.semanticPatterns)) {
                        for (const pattern of patterns) {
                            if (pattern.test(searchText)) return semantic;
                        }
                    }
                    return 'unknown';
                }
                
                calculateScore(attributes, context, semantic) {
                    let score = 50;
                    if (context.label) score += 20;
                    if (attributes.placeholder) score += 15;
                    if (semantic !== 'unknown') score += 15;
                    return Math.min(100, score);
                }
                
                rankFields(fields) {
                    return fields.sort((a, b) => b.score - a.score);
                }
            }
            
            window.DynamicFieldDetector = DynamicFieldDetector;
            """
            
            # Field Highlighter Script
            field_highlighter_script = """
            class FieldHighlighter {
                constructor() {
                    this.highlights = new Map();
                    this.styles = {
                        email: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
                        password: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
                        name: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
                        departure: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
                        destination: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
                        unknown: { border: '#9ca3af', bg: 'rgba(156, 163, 175, 0.1)' }
                    };
                }
                
                highlightFields(fields) {
                    this.removeAllHighlights();
                    fields.forEach(field => this.createHighlight(field));
                }
                
                createHighlight(field) {
                    const style = this.styles[field.semantic] || this.styles.unknown;
                    const highlight = document.createElement('div');
                    
                    highlight.style.cssText = `
                        position: fixed;
                        z-index: 10000;
                        left: ${field.rect.left}px;
                        top: ${field.rect.top}px;
                        width: ${field.rect.width}px;
                        height: ${field.rect.height}px;
                        border: 2px solid ${style.border};
                        background: ${style.bg};
                        border-radius: 4px;
                        pointer-events: none;
                        transition: all 0.3s ease;
                    `;
                    
                    // Add label
                    const label = document.createElement('div');
                    label.textContent = field.semantic;
                    label.style.cssText = `
                        position: absolute;
                        top: -25px;
                        left: 0;
                        background: ${style.border};
                        color: white;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 12px;
                        font-weight: bold;
                    `;
                    highlight.appendChild(label);
                    
                    document.body.appendChild(highlight);
                    this.highlights.set(field.id, highlight);
                }
                
                removeAllHighlights() {
                    this.highlights.forEach(highlight => highlight.remove());
                    this.highlights.clear();
                }
            }
            
            window.FieldHighlighter = FieldHighlighter;
            """
            
            # Inject both scripts
            await page.add_script_tag(content=field_detection_script)
            await page.add_script_tag(content=field_highlighter_script)
            
        except Exception as e:
            logger.error(f"Failed to inject field detection scripts: {e}")
            raise
    
    async def smart_field_fill(self, page: Page, field_data: Dict[str, str]) -> Dict[str, bool]:
        """Fill fields using smart field mapping"""
        
        if not self.detected_fields:
            await self.detect_and_highlight_fields(page)
        
        results = {}
        
        for data_key, data_value in field_data.items():
            success = await self.fill_field_by_semantic_type(page, data_key, data_value)
            results[data_key] = success
            
        return results
    
    async def fill_field_by_semantic_type(self, page: Page, semantic_type: str, value: str) -> bool:
        """Fill a field based on its semantic type"""
        
        # Find the best matching field
        matching_fields = [
            field for field in self.detected_fields 
            if field['semantic'] == semantic_type
        ]
        
        if not matching_fields:
            # Fallback to partial matching
            matching_fields = [
                field for field in self.detected_fields
                if semantic_type.lower() in field['semantic'].lower()
            ]
        
        if not matching_fields:
            logger.warning(f"No matching field found for semantic type: {semantic_type}")
            return False
        
        # Use the highest scored field
        best_field = max(matching_fields, key=lambda x: x['score'])
        
        try:
            # Fill the field using multiple strategies
            success = await page.evaluate("""
                (fieldData, value) => {
                    // Find element by attributes
                    let element = null;
                    
                    if (fieldData.attributes.id) {
                        element = document.getElementById(fieldData.attributes.id);
                    }
                    
                    if (!element && fieldData.attributes.name) {
                        element = document.querySelector(`[name="${fieldData.attributes.name}"]`);
                    }
                    
                    if (!element && fieldData.attributes.placeholder) {
                        element = document.querySelector(`[placeholder="${fieldData.attributes.placeholder}"]`);
                    }
                    
                    if (element) {
                        element.focus();
                        element.value = value;
                        
                        // Trigger events
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                    return false;
                }
            """, best_field, value)
            
            if success:
                logger.info(f"Successfully filled {semantic_type} field with value: {value}")
            else:
                logger.warning(f"Failed to fill {semantic_type} field")
                
            return success
            
        except Exception as e:
            logger.error(f"Error filling field {semantic_type}: {e}")
            return False
    
    async def remove_highlights(self, page: Page):
        """Remove all field highlights"""
        try:
            await page.evaluate("""
                () => {
                    if (window.FieldHighlighter) {
                        const highlighter = new window.FieldHighlighter();
                        highlighter.removeAllHighlights();
                    }
                }
            """)
        except Exception as e:
            logger.error(f"Error removing highlights: {e}")
    
    async def get_field_suggestions(self, page: Page, user_data: Dict[str, str]) -> Dict[str, List[Dict]]:
        """Get suggestions for field mappings based on user data"""
        
        if not self.detected_fields:
            await self.detect_and_highlight_fields(page)
        
        suggestions = {}
        
        for data_key, data_value in user_data.items():
            field_suggestions = []
            
            for field in self.detected_fields:
                confidence = self.calculate_mapping_confidence(data_key, field)
                if confidence > 0.3:  # Threshold for suggestions
                    field_suggestions.append({
                        'field': field,
                        'confidence': confidence
                    })
            
            # Sort by confidence
            field_suggestions.sort(key=lambda x: x['confidence'], reverse=True)
            suggestions[data_key] = field_suggestions[:3]  # Top 3 suggestions
        
        return suggestions
    
    def calculate_mapping_confidence(self, data_key: str, field: Dict) -> float:
        """Calculate confidence score for field mapping"""
        
        base_score = field['score'] / 100.0  # Normalize to 0-1
        
        # Semantic matching bonus
        semantic_bonus = 0
        if data_key.lower() == field['semantic'].lower():
            semantic_bonus = 0.5
        elif data_key.lower() in field['semantic'].lower():
            semantic_bonus = 0.3
        
        # Context matching bonus
        context_bonus = 0
        context_text = (
            field['context'].get('label', '') + ' ' +
            ' '.join(field['context'].get('nearbyText', [])) + ' ' +
            field['attributes'].get('placeholder', '')
        ).lower()
        
        if data_key.lower() in context_text:
            context_bonus = 0.2
        
        return min(1.0, base_score + semantic_bonus + context_bonus)


class SmartFlightSearchAutomation(EnhancedBrowserAutomation):
    """Enhanced flight search automation using dynamic field detection"""
    
    async def search_flights(self, page: Page, flight_data: Dict[str, str]) -> bool:
        """Enhanced flight search using dynamic field detection"""
        
        try:
            # Detect and highlight all fields
            fields = await self.detect_and_highlight_fields(page)
            logger.info(f"Detected {len(fields)} fields on the page")
            
            # Map flight data to semantic types
            field_mapping = {
                'departure': flight_data.get('from', ''),
                'destination': flight_data.get('to', ''),
                'date': flight_data.get('departure_date', ''),
                'email': flight_data.get('email', ''),
                'name': flight_data.get('passenger_name', '')
            }
            
            # Filter out empty values
            field_mapping = {k: v for k, v in field_mapping.items() if v}
            
            # Fill fields using smart mapping
            results = await self.smart_field_fill(page, field_mapping)
            
            # Check if all required fields were filled
            required_fields = ['departure', 'destination']
            all_required_filled = all(
                results.get(field, False) for field in required_fields
                if field_mapping.get(field)  # Only check if data exists
            )
            
            if all_required_filled:
                # Look for and click search button
                search_clicked = await self.click_search_button(page)
                if search_clicked:
                    logger.info("Flight search initiated successfully")
                    return True
                else:
                    logger.warning("Fields filled but search button not found")
                    return False
            else:
                failed_fields = [
                    field for field in required_fields 
                    if field_mapping.get(field) and not results.get(field, False)
                ]
                logger.error(f"Failed to fill required fields: {failed_fields}")
                return False
                
        except Exception as e:
            logger.error(f"Flight search automation error: {e}")
            return False
    
    async def click_search_button(self, page: Page) -> bool:
        """Find and click the search button using multiple strategies"""
        
        search_selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Search")',
            'button:has-text("Find")',
            'button:has-text("Go")',
            '[role="button"]:has-text("Search")',
            '.search-button',
            '.btn-search',
            '#search-btn',
            'button:contains("Search")',
            'button:contains("Find")'
        ]
        
        for selector in search_selectors:
            try:
                element = await page.wait_for_selector(selector, timeout=2000)
                if element:
                    await element.click()
                    logger.info(f"Clicked search button: {selector}")
                    return True
            except Exception:
                continue
        
        logger.warning("No search button found with any selector")
        return False
