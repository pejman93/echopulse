/**
 * Hopes & Sorrows - Main Application Controller
 * Interactive emotion visualization using P5.js and Canvas 2D
 */

class HopesSorrowsApp {
    constructor() {
        // Core properties
        this.socket = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingTimer = null;
        this.recordingStartTime = null;
        this.maxRecordingTime = 44000; // 44 seconds
        this.sessionId = this.generateSessionId();
        
        // UI Elements
        this.elements = {};
        
        // Emotion Visualizers
        this.emotionVisualizer = null;
        
        // Blob management
        this.currentTooltip = null;
        this.tooltipTimer = null;
        this.newBlobHighlights = []; // Initialize tracking array
        this.newBlobIds = []; // Initialize tracking array
        this.highlightTrackingInterval = null; // Track highlight following system
        this.voiceWaves = []; // Track voice wave elements
        this.voiceWaveInterval = null; // Track voice wave animation
        
        // Status management
        this.currentStatus = 'ready';
        this.isProcessingAnalysis = false; // Prevent duplicate analysis handling
        this.statusMessages = {
            ready: {
                main: 'Ready to Record',
                sub: 'Click to share your emotional journey'
            },
            recording: {
                main: 'Recording...',
                sub: 'Share your hopes and sorrows'
            },
            processing: {
                main: 'Analyzing...',
                sub: 'Understanding your emotions'
            },
            complete: {
                main: '✨ Analysis Complete!',
                sub: '🎉 Your emotions have been captured!'
            },
            error: {
                main: 'Something went wrong',
                sub: 'Please try again'
            }
        };
        
        // Initialize the application
        this.init();
    }
    
    /**
     * Initialize the application
     */
    async init() {
        console.log('🚀 Initializing Hopes & Sorrows App...');
        
        // Always hide loading overlay after a maximum time
        const maxLoadingTime = setTimeout(() => {
            console.warn('⚠️ Maximum loading time reached, forcing initialization to complete');
            this.hideLoadingOverlay();
        }, 10000); // 10 seconds max
        
        try {
            // Show loading overlay
            this.showLoadingOverlay();
            
            // Initialize UI elements (critical - must succeed)
            this.initializeElements();
            
            // Initialize WebSocket connection (with timeout)
            try {
                await this.initializeSocket();
            } catch (error) {
                console.warn('⚠️ WebSocket initialization failed, continuing without real-time features:', error);
            }
            
            // Initialize visualizers (with fallback)
            try {
                await this.initializeVisualizer();
            } catch (error) {
                console.warn('⚠️ Visualizer initialization failed:', error);
                this.showError('Visualization system failed to initialize. Some features may not work properly.');
            }
            
            // Load existing blobs (non-critical)
            try {
                await this.loadExistingBlobs();
            } catch (error) {
                console.warn('⚠️ Failed to load existing blobs, starting fresh:', error);
            }
            
            // Initialize recording functionality
            this.initializeRecording();
            
            // Initialize UI interactions
            this.initializeUI();
            
            // Clear the max loading timeout
            clearTimeout(maxLoadingTime);
            
            // Hide loading overlay
            this.hideLoadingOverlay();
            
            console.log('✅ App initialization complete!');
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            clearTimeout(maxLoadingTime);
            this.hideLoadingOverlay();
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }
    
    /**
     * Initialize UI elements
     */
    initializeElements() {
        console.log('🎯 Initializing UI elements...');
        
        // Core elements
        this.elements = {
            // Visualization
            visualizationContainer: document.getElementById('visualization-container'),
            
            // Recording interface
            recordBtn: document.getElementById('record-button'),
            statusText: document.querySelector('.status-text'),
            statusSubtitle: document.querySelector('.status-subtitle'),
            timer: document.querySelector('.timer'),
            timerText: document.querySelector('#timer-seconds'),
            timerProgress: document.querySelector('#timer-progress'),
            
            // Panels
            processingPanel: document.querySelector('.processing-panel'),
            errorPanel: document.querySelector('.error-panel'),
            blobInfoPanel: document.getElementById('blob-info-panel'),
            blobInfoToggle: document.getElementById('blob-info-toggle'),
            analysisConfirmation: document.querySelector('.analysis-confirmation') || document.getElementById('analysis-confirmation'),
            
            // Loading
            loadingOverlay: document.querySelector('.loading-overlay'),
            
            // Stats
            blobCount: document.querySelector('#blob-counter'),
            categoryStats: document.querySelectorAll('.category-stat .category-count')
        };
        
        // Validate required elements
        const requiredElements = [
            'visualizationContainer', 'recordBtn', 'statusText', 
            'loadingOverlay', 'blobInfoPanel'
        ];
        
        for (const elementName of requiredElements) {
            if (!this.elements[elementName]) {
                throw new Error(`Required element not found: ${elementName}`);
            }
        }
        
        console.log('✅ UI elements initialized');
    }
    
    /**
     * Initialize WebSocket connection
     */
    async initializeSocket() {
        console.log('🔌 Initializing WebSocket connection...');
        
        try {
            if (typeof io !== 'undefined') {
                this.socket = io();
                
                this.socket.on('connect', () => {
                    console.log('✅ Connected to server via WebSocket');
                });
                
                this.socket.on('disconnect', () => {
                    console.log('❌ Disconnected from server');
                });
                
                this.socket.on('connected', (data) => {
                    console.log('🎉 Server connection confirmed:', data);
                });
                
                // ENHANCED: Handle blob_added events for real-time updates
                this.socket.on('blob_added', (blobData) => {
                    console.log('🫧 Real-time blob received:', blobData);
                    console.log('🔍 SESSION ID COMPARISON:');
                    console.log(`   Blob session_id: "${blobData.session_id}"`);
                    console.log(`   App session_id: "${this.sessionId}"`);
                    console.log(`   Match: ${blobData.session_id === this.sessionId}`);
                    console.log(`   Type comparison: ${typeof blobData.session_id} vs ${typeof this.sessionId}`);
                    
                    // Only add if this isn't from our own session (to avoid duplicates)
                    if (blobData.session_id !== this.sessionId) {
                        console.log('🫧 Adding blob from another session');
                        if (this.emotionVisualizer) {
                            this.emotionVisualizer.addBlob(blobData);
                            this.updateBlobStats();
                        }
                    } else {
                        console.log('🫧 Ignoring blob from own session (already handled)');
                    }
                });
                
                this.socket.on('blob_removed', (data) => {
                    console.log('🗑️ Blob removed:', data);
                    // Handle blob removal if needed
                });
                
                this.socket.on('visualization_cleared', () => {
                    console.log('🧹 Visualization cleared by another client');
                    if (this.emotionVisualizer) {
                        this.emotionVisualizer.clearAllBlobs();
                        this.updateBlobStats();
                    }
                });
                
                // ENHANCED: Handle recording progress from other clients
                this.socket.on('recording_progress', (data) => {
                    if (data.sessionId !== this.sessionId) {
                        console.log('🎤 Another client is recording:', data);
                        // Could add visual indicator that someone else is recording
                    }
                });
                
                console.log('✅ WebSocket event handlers registered');
            } else {
                console.error('❌ Socket.IO not available');
            }
        } catch (error) {
            console.error('❌ Failed to initialize WebSocket:', error);
        }
    }
    
    /**
     * Initialize Emotion Visualizers
     */
    async initializeVisualizer() {
        console.log('🎨 Initializing Emotion Visualizers...');
        
        try {
            // Check if required classes are available
            console.log('🔍 Checking visualizer classes...');
            console.log('EmotionVisualizer available:', typeof EmotionVisualizer !== 'undefined');
            console.log('BlobEmotionVisualizer available:', typeof BlobEmotionVisualizer !== 'undefined');
            console.log('p5 available:', typeof p5 !== 'undefined');
            
            // Initialize background emotion visualizer
            if (typeof EmotionVisualizer !== 'undefined') {
                console.log('🎨 Initializing background visualizer...');
                this.backgroundVisualizer = new EmotionVisualizer();
                await this.backgroundVisualizer.init(this.elements.visualizationContainer);
                console.log('✅ Background visualizer initialized');
            } else {
                console.warn('⚠️ EmotionVisualizer class not found, skipping background visualizer');
            }
            
            // Initialize blob emotion visualizer
            if (typeof BlobEmotionVisualizer !== 'undefined') {
                console.log('🫧 Initializing blob visualizer...');
                this.emotionVisualizer = new BlobEmotionVisualizer();
                await this.emotionVisualizer.init(this.elements.visualizationContainer);
                console.log('✅ Blob visualizer initialized');
            } else {
                throw new Error('BlobEmotionVisualizer class not found');
            }
            
            console.log('✅ All visualizers initialized successfully');
            
        } catch (error) {
            console.error('❌ Visualizer initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Load existing blobs from the database
     */
    async loadExistingBlobs() {
        console.log('📊 Loading existing emotion blobs...');
        
        try {
            const response = await fetch('/api/get_all_blobs');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.blobs) {
                console.log(`📊 Found ${data.blobs.length} existing blobs`);
                
                // FIXED: Wait for all blobs to be added before updating stats
                let blobsLoaded = 0;
                const totalBlobs = data.blobs.length;
                
                if (totalBlobs === 0) {
                    console.log('📊 No existing blobs found');
                    // Update stats with empty array to reset counters
                    this.updateBlobStats([]);
                    return;
                }
                
                // Add blobs to visualizer with staggered timing
                data.blobs.forEach((blobData, index) => {
                    setTimeout(() => {
                        this.emotionVisualizer.addBlob(blobData);
                        blobsLoaded++;
                        
                        // Update stats when all blobs are loaded
                        if (blobsLoaded === totalBlobs) {
                            setTimeout(() => {
                                console.log('📊 All blobs loaded, updating stats...');
                                this.updateBlobStats(data.blobs);
                            }, 100); // Small delay to ensure visualizer is updated
                        }
                    }, index * 100); // 100ms delay between each blob
                });
                
                console.log('✅ Existing blobs loading started');
            } else {
                console.log('📊 No existing blobs found');
                // Update stats with empty array to reset counters
                this.updateBlobStats([]);
            }
            
        } catch (error) {
            console.error('❌ Failed to load existing blobs:', error);
            // Don't throw - app can still function without existing blobs
            // Reset stats to show zeros
            this.updateBlobStats([]);
        }
    }
    
    /**
     * Initialize recording functionality
     */
    initializeRecording() {
        console.log('🎤 Initializing recording functionality...');
        
        if (!this.elements.recordBtn) {
            console.error('❌ Record button not found');
            return;
        }
        
        // RE-ENABLED: Main app recording system (this was working properly)
        this.elements.recordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        });
        
        console.log('✅ Recording functionality initialized');
    }
    
    /**
     * Initialize UI interactions
     */
    initializeUI() {
        console.log('🎯 Initializing UI interactions...');
        
        // Clean up any existing highlights on initialization
        this.cleanupAllHighlights();
        
        // Add page unload cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanupAllHighlights();
        });
        
        // Add page visibility change cleanup
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Clean up highlights when page becomes hidden
                setTimeout(() => {
                    this.cleanupAllHighlights();
                }, 1000);
            }
        });
        
        // Blob info toggle
        if (this.elements.blobInfoToggle) {
            this.elements.blobInfoToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleBlobInfo();
            });
        }
        
        // Blob info panel close button
        const blobInfoClose = document.querySelector('.blob-info-close');
        if (blobInfoClose) {
            blobInfoClose.addEventListener('click', () => {
                this.toggleBlobInfo();
            });
        }
        
        // Analysis confirmation buttons
        const continueBtn = document.getElementById('analysis-continue-btn');
        const viewBtn = document.getElementById('analysis-view-btn');
        
        if (continueBtn) {
            continueBtn.addEventListener('click', (e) => {
                console.log('🎯 Continue button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.hideAnalysisConfirmation();
            });
        } else {
            console.warn('⚠️ Continue button not found');
        }
        
        if (viewBtn) {
            viewBtn.addEventListener('click', (e) => {
                console.log('🎯 View button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.hideAnalysisConfirmation();
                setTimeout(() => {
                    this.toggleBlobInfo();
                }, 300);
            });
        } else {
            console.warn('⚠️ View button not found');
        }
        
        // Error panel dismiss
        const errorDismiss = document.querySelector('.error-dismiss');
        if (errorDismiss) {
            errorDismiss.addEventListener('click', () => {
                this.hideError();
            });
        }
        
        // Analysis confirmation actions
        const analysisActions = document.querySelectorAll('.analysis-btn');
        analysisActions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (btn.classList.contains('primary')) {
                    this.hideAnalysisConfirmation();
                } else {
                    this.hideAnalysisConfirmation();
                }
            });
        });
        
        // Instructions panel close button
        const instructionsClose = document.querySelector('.instructions-close');
        if (instructionsClose) {
            instructionsClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hideInstructions();
            });
        }
        
        // Category stats as toggle controls (in blob info panel)
        const categoryStats = document.querySelectorAll('.category-stat');
        categoryStats.forEach(stat => {
            // Initialize as active
            stat.classList.add('active');
            
            stat.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const category = stat.dataset.category;
                const isActive = stat.classList.contains('active');
                
                // Toggle the visual state
                if (isActive) {
                    stat.classList.remove('active');
                    stat.classList.add('inactive');
                } else {
                    stat.classList.remove('inactive');
                    stat.classList.add('active');
                }
                
                // Update the visualizer
                if (this.emotionVisualizer && this.emotionVisualizer.setCategoryVisibility) {
                    this.emotionVisualizer.setCategoryVisibility(category, !isActive);
                }
                
                console.log(`🎨 Toggled category ${category}: ${!isActive ? 'visible' : 'hidden'}`);
            });
        });
        
        console.log('✅ UI interactions initialized');
    }
    
    /**
     * Clean up all highlights from DOM
     */
    cleanupAllHighlights() {
        console.log('🧹 Performing comprehensive highlight cleanup');
        
        // Clear tracking arrays
        this.newBlobHighlights = [];
        this.newBlobIds = [];
        
        // Stop tracking systems
        this.stopHighlightTracking();
        this.removeVoiceWaves(); // Clean up voice waves too
        
        // Remove all highlight elements from DOM
        const allHighlights = document.querySelectorAll(
            '.new-blob-highlight, .new-blob-highlight-positioned, ' +
            '.new-blob-spotlight, .new-blob-label, .new-blob-label-positioned, ' +
            '.voice-wave'
        );
        
        allHighlights.forEach(element => {
            if (element.parentNode) {
                element.remove();
            }
        });
        
        // Clear blob markers in visualizer
        if (this.emotionVisualizer && this.emotionVisualizer.clearNewBlobMarkers) {
            this.emotionVisualizer.clearNewBlobMarkers();
        }
        
        console.log(`🧹 Cleaned up ${allHighlights.length} highlight elements`);
    }
    
    /**
     * Add visualization mode controls to the UI
     */
    addVisualizationControls() {
        // Remove complex controls - keep it simple
        console.log('✅ Simple visualization controls ready');
    }
    
    /**
     * Update category UI based on visibility
     */
    updateCategoryUI(category, visible) {
        const categoryElement = document.querySelector(`.category-stat.${category}`);
        if (categoryElement) {
            if (visible) {
                categoryElement.style.opacity = '1';
                categoryElement.style.filter = 'none';
            } else {
                categoryElement.style.opacity = '0.5';
                categoryElement.style.filter = 'grayscale(100%)';
            }
        }
    }
    
    /**
     * Start recording audio
     */
    async startRecording() {
        console.log('🎤 Starting recording...');
        
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });
            
            // Initialize MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };
            
            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            // Update UI
            this.updateRecordingUI(true);
            this.startRecordingTimer();
            
            // Add visual feedback to visualizer
            if (this.emotionVisualizer && this.emotionVisualizer.startRecording) {
                this.emotionVisualizer.startRecording();
            }
            
            console.log('✅ Recording started');
            
        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.showError('Failed to access microphone. Please check permissions.');
        }
    }
    
    /**
     * Stop audio recording
     */
    stopRecording() {
        console.log('🛑 Stopping recording...');
        
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Stop all tracks
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
            
            // Update UI
            this.updateRecordingUI(false);
            this.stopRecordingTimer();
            
            // Add visual feedback to visualizer
            if (this.emotionVisualizer && this.emotionVisualizer.stopRecording) {
                this.emotionVisualizer.stopRecording();
            }
            
            console.log('✅ Recording stopped');
        }
    }
    
    /**
     * Process the recorded audio
     */
    async processRecording() {
        console.log('⚙️ Processing recording...');
        
        try {
            // Show processing state
            this.updateStatus('processing');
            this.showProcessingPanel();
            
            // Create audio blob
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            
            // Create form data
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('session_id', this.sessionId);
            
            // Upload and process
            const response = await fetch('/upload_audio', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Recording processed successfully');
                
                // Handle analysis completion directly
                this.handleAnalysisComplete({
                    blobs: result.blobs,
                    processing_summary: result.processing_summary,
                    session_id: result.session_id
                });
                
            } else {
                throw new Error(result.error || 'Processing failed');
            }
            
        } catch (error) {
            console.error('❌ Failed to process recording:', error);
            this.hideProcessingPanel();
            this.updateStatus('error');
            this.showError('Failed to process recording. Please try again.');
        }
    }
    
    /**
     * Handle analysis completion
     */
    handleAnalysisComplete(data) {
        console.log('🎉 Handling analysis completion:', data);
        console.log('🔍 ANALYSIS COMPLETE SESSION DATA:');
        console.log(`   Data session_id: "${data.session_id}"`);
        console.log(`   App session_id: "${this.sessionId}"`);
        console.log(`   Blob count: ${data.blobs ? data.blobs.length : 0}`);
        console.log(`   Call stack trace:`, new Error().stack);
        
        // Prevent duplicate handling
        if (this.isProcessingAnalysis) {
            console.log('⚠️ Analysis already being processed, skipping');
            return;
        }
        
        this.isProcessingAnalysis = true;
        
        // ENHANCED: Validate data structure
        if (!data || !data.blobs) {
            console.error('❌ Invalid analysis data received:', data);
            this.showError('Analysis completed but data was corrupted. Please try again.');
            this.isProcessingAnalysis = false;
            return;
        }
        
        console.log(`🫧 Processing ${data.blobs.length} new blobs...`);
        
        // Hide processing panel first
        this.hideProcessingPanel();
        
        // Add new blobs to visualizer with enhanced animations
        if (data.blobs && this.emotionVisualizer) {
            console.log('🎨 Adding blobs to visualizer...');
            this.animateNewBlobEntries(data.blobs);
        } else if (!this.emotionVisualizer) {
            console.error('❌ Emotion visualizer not available!');
            this.showError('Visualization system not ready. Please refresh the page.');
            this.isProcessingAnalysis = false;
            return;
        }
        
        // Show analysis confirmation with detailed results
        setTimeout(() => {
            console.log('📊 Showing analysis confirmation...');
            this.showAnalysisConfirmation(data);
        }, 800); // Delay to let blob animations play
        
        // Update stats
        setTimeout(() => {
            console.log('📈 Updating blob statistics...');
            this.updateBlobStats(data.blobs);
        }, data.blobs ? data.blobs.length * 300 + 800 : 800);
        
        this.updateStatus('complete');
        
        // ENHANCED: Announce success to user
        if (data.blobs && data.blobs.length > 0) {
            console.log(`✨ Successfully created ${data.blobs.length} emotion blob(s)!`);
            
            // Create a visual success indicator
            setTimeout(() => {
                this.showNewBlobIndicator(data.blobs.length);
            }, 1000);
        }
        
        // Reset to ready after a delay
        setTimeout(() => {
            this.updateStatus('ready');
            this.isProcessingAnalysis = false; // Reset flag
        }, 3000);
    }

    /**
     * Animate new blob entries with visual effects
     */
    animateNewBlobEntries(blobs) {
        console.log('🎨 Animating new blob entries:', blobs.length);
        
        // ENHANCED DEBUGGING: Log detailed blob information
        console.log('🔍 DETAILED BLOB ANALYSIS:');
        blobs.forEach((blob, index) => {
            console.log(`   Blob ${index + 1}:`, {
                id: blob.id,
                text: blob.text?.substring(0, 50) + '...',
                category: blob.category,
                session_id: blob.session_id,
                speaker_id: blob.speaker_id
            });
        });
        
        // Check for duplicate texts in this batch
        const texts = blobs.map(b => b.text);
        const uniqueTexts = [...new Set(texts)];
        if (texts.length !== uniqueTexts.length) {
            console.warn('🚨 DUPLICATE TEXTS DETECTED IN BLOB BATCH!');
            console.warn(`   Total blobs: ${texts.length}, Unique texts: ${uniqueTexts.length}`);
        }
        
        // Check if visualizer already has any of these blobs
        if (this.emotionVisualizer && this.emotionVisualizer.blobs) {
            const existingTexts = this.emotionVisualizer.blobs.map(b => b.text);
            const duplicateWithExisting = blobs.filter(newBlob => 
                existingTexts.includes(newBlob.text)
            );
            
            if (duplicateWithExisting.length > 0) {
                console.warn('🚨 BLOBS DUPLICATE EXISTING VISUALIZER CONTENT!');
                console.warn(`   ${duplicateWithExisting.length} blobs already exist in visualizer`);
                duplicateWithExisting.forEach(blob => {
                    console.warn(`   Duplicate: "${blob.text?.substring(0, 30)}..."`);
                });
            }
        }
        
        // Create a visual indicator for new entries
        this.showNewBlobIndicator(blobs.length);
        
        // Store new blob IDs for highlighting
        this.newBlobIds = [];
        this.newBlobHighlights = []; // Track highlight elements
        
        // Add blobs with staggered timing and visual effects
        blobs.forEach((blobData, index) => {
            setTimeout(() => {
                console.log(`🫧 Adding blob ${index + 1}/${blobs.length} to visualizer:`, blobData.text?.substring(0, 30));
                
                // Add the blob to the visualizer
                const addedBlob = this.emotionVisualizer.addBlob(blobData);
                
                if (addedBlob) {
                    console.log(`✅ Blob added successfully with ID: ${addedBlob.id}`);
                } else {
                    console.warn(`⚠️ Blob ${index + 1} was not added to visualizer`);
                }
                
                // Store the blob ID for highlighting
                if (addedBlob && addedBlob.id) {
                    this.newBlobIds.push(addedBlob.id);
                    
                    // Wait a moment for the blob to be positioned, then highlight it
                    setTimeout(() => {
                        this.highlightNewBlobAtPosition(addedBlob);
                    }, 100);
                }
                
                // Add a subtle screen flash for the first blob
                if (index === 0) {
                    this.createScreenFlash();
                }
                
            }, index * 300); // Longer stagger for more dramatic effect
        });
        
        // Don't auto-remove highlights - they'll be removed when analysis panel closes
        console.log('🎨 New blob highlights will persist until analysis panel is closed');
    }

    /**
     * Highlight a newly added blob at its actual position
     */
    highlightNewBlobAtPosition(blob) {
        console.log('✨ Highlighting new blob at actual position:', blob.x, blob.y);
        
        const container = document.getElementById('visualization-container');
        if (!container) return;

        // Create highlight ring that follows the blob
        const ring = document.createElement('div');
        ring.className = 'new-blob-highlight-positioned';
        ring.dataset.blobId = blob.id;
        
        // Position at exact blob coordinates with aquamarine glow
        ring.style.position = 'absolute';
        ring.style.width = '60px';
        ring.style.height = '60px';
        ring.style.border = '2px solid rgba(78, 205, 196, 0.8)'; // Aquamarine
        ring.style.borderRadius = '50%';
        ring.style.pointerEvents = 'none';
        ring.style.zIndex = '10';
        ring.style.boxShadow = '0 0 20px rgba(78, 205, 196, 0.6), inset 0 0 20px rgba(78, 205, 196, 0.2)'; // Neon glow
        
        // Create floating label that also follows
        const label = document.createElement('div');
        label.className = 'new-blob-label-positioned';
        label.textContent = `NEW ${blob.category.replace('_', ' ').toUpperCase()}`;
        label.dataset.blobId = blob.id;
        
        label.style.position = 'absolute';
        label.style.width = '90px';
        label.style.textAlign = 'center';
        label.style.color = '#4ECDC4'; // Aquamarine text
        label.style.fontSize = '9px';
        label.style.fontWeight = 'bold';
        label.style.textShadow = '0 0 8px rgba(78, 205, 196, 0.8)'; // Aquamarine glow
        label.style.pointerEvents = 'none';
        label.style.zIndex = '11';
        label.style.background = 'rgba(0, 0, 0, 0.8)';
        label.style.padding = '3px 6px';
        label.style.borderRadius = '10px';
        label.style.border = '1px solid rgba(78, 205, 196, 0.5)';
        
        // Function to update positions
        const updatePositions = () => {
            if (blob && container.contains(ring)) {
                ring.style.left = `${blob.x - 30}px`;  // Center the 60px ring
                ring.style.top = `${blob.y - 30}px`;
                label.style.left = `${blob.x - 45}px`;
                label.style.top = `${blob.y - 55}px`;
            }
        };
        
        // Store the update function for later cleanup
        ring.updatePosition = updatePositions;
        label.updatePosition = updatePositions;
        
        // Set initial positions
        updatePositions();
        
        container.appendChild(ring);
        container.appendChild(label);
        this.newBlobHighlights.push(ring);
        this.newBlobHighlights.push(label);
        
        // Animate the ring
        if (typeof anime !== 'undefined') {
            anime({
                targets: ring,
                scale: [0, 1.3, 1.0],
                opacity: [0, 1, 0.8],
                duration: 1200,
                easing: 'easeOutElastic(1, .6)',
                complete: () => {
                    // Continuous pulsing animation
                    anime({
                        targets: ring,
                        scale: [1.0, 1.2, 1.0],
                        opacity: [0.8, 1, 0.8],
                        duration: 2500,
                        loop: true,
                        easing: 'easeInOutSine'
                    });
                }
            });
            
            anime({
                targets: label,
                translateY: [-20, 0],
                opacity: [0, 1],
                scale: [0.8, 1],
                duration: 800,
                easing: 'easeOutBack'
            });
        }
        
        // Start position update loop
        this.startHighlightTracking();
    }

    /**
     * Start tracking highlights to follow blob positions
     */
    startHighlightTracking() {
        // Only start if not already running
        if (this.highlightTrackingInterval) return;
        
        this.highlightTrackingInterval = setInterval(() => {
            // Update all highlight positions
            this.newBlobHighlights.forEach(highlight => {
                if (highlight.updatePosition && highlight.parentNode) {
                    highlight.updatePosition();
                }
            });
        }, 16); // ~60 FPS
        
        console.log('🎯 Started highlight tracking system');
    }

    /**
     * Stop tracking highlights
     */
    stopHighlightTracking() {
        if (this.highlightTrackingInterval) {
            clearInterval(this.highlightTrackingInterval);
            this.highlightTrackingInterval = null;
            console.log('🎯 Stopped highlight tracking system');
        }
    }

    /**
     * Remove highlights from new blobs (called when analysis panel closes)
     */
    removeNewBlobHighlights() {
        console.log('🧹 Removing', this.newBlobHighlights.length, 'positioned blob highlights');
        
        // Stop tracking system
        this.stopHighlightTracking();
        
        // Force cleanup of any stuck highlights by searching DOM
        const stuckHighlights = document.querySelectorAll('.new-blob-highlight-positioned, .new-blob-label-positioned');
        stuckHighlights.forEach(element => {
            if (!this.newBlobHighlights.includes(element)) {
                console.log('🧹 Found stuck highlight, removing:', element);
                this.newBlobHighlights.push(element);
            }
        });
        
        if (typeof anime !== 'undefined' && this.newBlobHighlights.length > 0) {
            anime({
                targets: this.newBlobHighlights,
                opacity: [null, 0],
                scale: [null, 0.8],
                duration: 1000,
                easing: 'easeInCubic',
                complete: () => {
                    this.newBlobHighlights.forEach(highlight => {
                        if (highlight && highlight.parentNode) {
                            highlight.remove();
                        }
                    });
                    this.newBlobHighlights = [];
                    
                    // Double-check for any remaining stuck elements
                    setTimeout(() => {
                        const remainingHighlights = document.querySelectorAll('.new-blob-highlight-positioned, .new-blob-label-positioned');
                        remainingHighlights.forEach(element => {
                            console.log('🧹 Force removing remaining highlight:', element);
                            element.remove();
                        });
                    }, 100);
                }
            });
        } else {
            this.newBlobHighlights.forEach(highlight => {
                if (highlight && highlight.parentNode) {
                    highlight.remove();
                }
            });
            this.newBlobHighlights = [];
            
            // Fallback cleanup
            setTimeout(() => {
                const remainingHighlights = document.querySelectorAll('.new-blob-highlight-positioned, .new-blob-label-positioned');
                remainingHighlights.forEach(element => element.remove());
            }, 100);
        }
        
        // Clear the stored IDs and reset blob markers
        this.newBlobIds = [];
        if (this.emotionVisualizer && this.emotionVisualizer.clearNewBlobMarkers) {
            this.emotionVisualizer.clearNewBlobMarkers();
        }
    }

    /**
     * Show indicator for new blob entries
     */
    showNewBlobIndicator(count) {
        // Prevent duplicate indicators
        const existingIndicator = document.querySelector('.new-blob-indicator');
        if (existingIndicator) {
            console.log('⚠️ Blob indicator already visible, skipping');
            return;
        }

        // Create a temporary indicator
        const indicator = document.createElement('div');
        indicator.className = 'new-blob-indicator';
        indicator.innerHTML = `
            <div class="indicator-content">
                <div class="indicator-icon">✨</div>
                <div class="indicator-text">+${count} new emotion${count > 1 ? 's' : ''}</div>
            </div>
        `;
        
        document.body.appendChild(indicator);
        
        // Animate the indicator
        if (typeof anime !== 'undefined') {
            anime({
                targets: indicator,
                opacity: [0, 1],
                scale: [0.8, 1],
                duration: 600,
                easing: 'easeOutElastic(1, .8)',
                complete: () => {
                    setTimeout(() => {
                        anime({
                            targets: indicator,
                            opacity: [1, 0],
                            scale: [1, 0.8],
                            duration: 400,
                            easing: 'easeInCubic',
                            complete: () => indicator.remove()
                        });
                    }, 2000);
                }
            });
        }
    }

    /**
     * Create subtle screen flash effect
     */
    createScreenFlash() {
        const flash = document.createElement('div');
        flash.className = 'screen-flash';
        document.body.appendChild(flash);
        
        if (typeof anime !== 'undefined') {
            anime({
                targets: flash,
                opacity: [0, 0.1, 0],
                duration: 300,
                easing: 'easeInOutQuad',
                complete: () => flash.remove()
            });
        }
    }
    
    /**
     * Update recording UI state
     */
    updateRecordingUI(isRecording) {
        if (!this.elements.recordBtn) return;
        
        if (isRecording) {
            this.elements.recordBtn.classList.add('recording');
            this.elements.recordBtn.innerHTML = `
                <div class="record-stop-icon">
                    <div class="stop-square"></div>
                </div>
            `;
            this.updateStatus('recording');
            this.startRecordingVisualEffects();
        } else {
            this.elements.recordBtn.classList.remove('recording');
            this.elements.recordBtn.innerHTML = `
                <div class="record-icon">
                    <div class="record-dot"></div>
                </div>
            `;
            this.stopRecordingVisualEffects();
        }
    }

    /**
     * Start visual effects during recording
     */
    startRecordingVisualEffects() {
        // Add voice-responsive wave animation to the background
        this.createVoiceWaves();
        
        // Add pulse effect to record button
        this.startRecordButtonPulse();
    }

    /**
     * Stop visual effects when recording ends
     */
    stopRecordingVisualEffects() {
        // Remove wave animation
        this.removeVoiceWaves();
        
        // Stop pulse effect
        this.stopRecordButtonPulse();
    }

    /**
     * Create voice-responsive animated waves during recording
     */
    createVoiceWaves() {
        const container = document.getElementById('visualization-container');
        if (!container) return;

        // Create multiple wave lines that will oscillate
        this.voiceWaves = [];
        const waveCount = 5;
        
        for (let i = 0; i < waveCount; i++) {
            const wave = document.createElement('div');
            wave.className = 'voice-wave';
            wave.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1;
                background: transparent;
            `;
            
            // Create SVG for smooth wave rendering
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.cssText = `
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
            `;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.style.cssText = `
                fill: none;
                stroke: rgba(78, 205, 196, ${0.2 - i * 0.03});
                stroke-width: ${2 + i};
                stroke-linecap: round;
            `;
            
            svg.appendChild(path);
            wave.appendChild(svg);
            container.appendChild(wave);
            
            this.voiceWaves.push({
                element: wave,
                path: path,
                frequency: 0.02 + i * 0.005, // Different frequencies for each wave
                amplitude: 25 + i * 8, // Slightly smaller amplitudes for more centered look
                phase: i * Math.PI / 2.5, // Adjusted phase distribution
                baseY: window.innerHeight * (0.45 + i * 0.02) // Centered around middle (45-53%)
            });
        }
        
        // Start wave animation
        this.animateVoiceWaves();
    }

    /**
     * Animate voice waves continuously during recording
     */
    animateVoiceWaves() {
        if (!this.voiceWaves || this.voiceWaves.length === 0) return;
        
        let time = 0;
        
        this.voiceWaveInterval = setInterval(() => {
            time += 1;
            
            this.voiceWaves.forEach((wave, index) => {
                // Simulate voice intensity (in real implementation, this could use WebAudio API)
                const voiceIntensity = 0.5 + 0.5 * Math.sin(time * 0.1 + index);
                
                // Generate wave path
                const points = [];
                const width = window.innerWidth;
                const segments = 50;
                
                for (let i = 0; i <= segments; i++) {
                    const x = (i / segments) * width;
                    const progress = i / segments;
                    
                    // Create organic wave motion with multiple harmonics for richer patterns
                    const primaryWave = Math.sin(time * wave.frequency + progress * Math.PI * 2 + wave.phase);
                    const harmonicWave = Math.sin(time * wave.frequency * 2 + progress * Math.PI * 4 + wave.phase) * 0.3;
                    const y = wave.baseY + (primaryWave + harmonicWave) * wave.amplitude * voiceIntensity;
                    
                    points.push(`${x},${y}`);
                }
                
                // Create smooth SVG path
                let pathData = `M ${points[0]}`;
                for (let i = 1; i < points.length; i++) {
                    pathData += ` L ${points[i]}`;
                }
                
                wave.path.setAttribute('d', pathData);
            });
        }, 16); // ~60 FPS
    }

    /**
     * Remove recording waves
     */
    removeVoiceWaves() {
        if (this.voiceWaveInterval) {
            clearInterval(this.voiceWaveInterval);
            this.voiceWaveInterval = null;
        }
        
        if (this.voiceWaves) {
            this.voiceWaves.forEach(wave => {
                if (wave.element && wave.element.parentNode) {
                    wave.element.remove();
                }
            });
            this.voiceWaves = [];
        }
        
        // Clean up any remaining wave elements
        const remainingWaves = document.querySelectorAll('.voice-wave');
        remainingWaves.forEach(wave => wave.remove());
    }

    /**
     * Start record button pulse animation
     */
    startRecordButtonPulse() {
        if (!this.elements.recordBtn) return;
        
        console.log('🟦 Adding pulse animation to record button');
        this.elements.recordBtn.classList.add('pulsing');
    }

    /**
     * Stop record button pulse animation
     */
    stopRecordButtonPulse() {
        if (!this.elements.recordBtn) return;
        
        console.log('🟦 Removing pulse animation from record button');
        this.elements.recordBtn.classList.remove('pulsing');
    }
    
    /**
     * Start recording timer
     */
    startRecordingTimer() {
        if (!this.elements.timer || !this.elements.timerText || !this.elements.timerProgress) {
            return;
        }
        
        this.elements.timer.classList.add('visible');
        
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const remaining = Math.max(0, this.maxRecordingTime - elapsed);
            const progress = (elapsed / this.maxRecordingTime) * 100;
            
            // Update timer display
            const seconds = Math.ceil(remaining / 1000);
            this.elements.timerText.textContent = seconds;
            
            // Update progress circle
            if (this.elements.timerProgress) {
                const circumference = 2 * Math.PI * 45; // radius = 45
                const offset = circumference - (progress / 100) * circumference;
                this.elements.timerProgress.style.strokeDashoffset = offset;
            }
            
            // Auto-stop when time is up
            if (remaining <= 0) {
                this.stopRecording();
            }
        }, 100);
    }
    
    /**
     * Stop recording timer
     */
    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        if (this.elements.timer) {
            this.elements.timer.classList.remove('visible');
        }
    }
    
    /**
     * Update status display
     */
    updateStatus(status) {
        this.currentStatus = status;
        const statusData = this.statusMessages[status];
        
        if (statusData && this.elements.statusText) {
            this.elements.statusText.textContent = statusData.main;
            
            if (this.elements.statusSubtitle) {
                this.elements.statusSubtitle.textContent = statusData.sub;
            }
        }
    }
    
    /**
     * Show/hide loading overlay
     */
    showLoadingOverlay() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('hidden');
        }
    }
    
    hideLoadingOverlay() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('hidden');
        }
    }
    
    /**
     * Show/hide processing panel
     */
    showProcessingPanel() {
        if (this.elements.processingPanel) {
            this.elements.processingPanel.classList.add('visible');
        }
    }
    
    hideProcessingPanel() {
        if (this.elements.processingPanel) {
            this.elements.processingPanel.classList.remove('visible');
        }
    }
    
    /**
     * Show/hide error panel
     */
    showError(message) {
        if (this.elements.errorPanel) {
            const errorText = this.elements.errorPanel.querySelector('.error-text');
            if (errorText) {
                errorText.textContent = message;
            }
            this.elements.errorPanel.classList.add('visible');
        }
    }
    
    hideError() {
        if (this.elements.errorPanel) {
            this.elements.errorPanel.classList.remove('visible');
        }
    }
    
    /**
     * Show/hide analysis confirmation
     */
    showAnalysisConfirmation(data) {
        console.log('📊 Attempting to show analysis confirmation with data:', data);
        
        // Ensure the element exists
        if (!this.elements.analysisConfirmation) {
            console.error('❌ Analysis confirmation element not found in this.elements');
            // Try to find it directly
            this.elements.analysisConfirmation = document.getElementById('analysis-confirmation');
            if (!this.elements.analysisConfirmation) {
                console.error('❌ Analysis confirmation element not found in DOM');
                // Create a fallback notification
                this.showAnalysisCompleteFallback(data);
                return;
            }
        }

        // Prevent duplicate panels - but reset if stuck
        if (this.elements.analysisConfirmation.classList.contains('visible')) {
            console.log('⚠️ Analysis confirmation already visible');
            // Check if it's been visible for too long (stuck state)
            const visibleTime = Date.now() - (this.lastAnalysisShown || 0);
            if (visibleTime < 2000) { // Less than 2 seconds ago
                console.log('⚠️ Recently shown, skipping to prevent spam');
                return;
            } else {
                console.log('⚠️ Clearing stuck analysis confirmation');
                this.hideAnalysisConfirmation();
            }
        }

        console.log('📊 Showing analysis confirmation with data:', data);
        this.lastAnalysisShown = Date.now();

        // Populate analysis data
        this.populateAnalysisData(data);

        // Show the panel
        this.elements.analysisConfirmation.classList.add('visible');
        
        // Re-attach button event listeners after panel is shown
        setTimeout(() => {
            const continueBtn = document.getElementById('analysis-continue-btn');
            const viewBtn = document.getElementById('analysis-view-btn');
            
            if (continueBtn) {
                // Remove any existing listeners
                continueBtn.replaceWith(continueBtn.cloneNode(true));
                const newContinueBtn = document.getElementById('analysis-continue-btn');
                newContinueBtn.addEventListener('click', (e) => {
                    console.log('🎯 Continue button clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideAnalysisConfirmation();
                });
                console.log('✅ Continue button listener attached');
            } else {
                console.warn('⚠️ Continue button not found after panel shown');
            }
            
            if (viewBtn) {
                // Remove any existing listeners
                viewBtn.replaceWith(viewBtn.cloneNode(true));
                const newViewBtn = document.getElementById('analysis-view-btn');
                newViewBtn.addEventListener('click', (e) => {
                    console.log('🎯 View button clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideAnalysisConfirmation();
                    setTimeout(() => {
                        this.toggleBlobInfo();
                    }, 300);
                });
                console.log('✅ View button listener attached');
            } else {
                console.warn('⚠️ View button not found after panel shown');
            }
            
            // Add backdrop click handler
            const handleBackdropClick = (e) => {
                // Only close if clicking the backdrop (not the content)
                if (e.target === this.elements.analysisConfirmation && !e.target.closest('.analysis-confirmation-content')) {
                    console.log('🎯 Backdrop clicked, closing analysis confirmation');
                    this.hideAnalysisConfirmation();
                    this.elements.analysisConfirmation.removeEventListener('click', handleBackdropClick);
                }
            };
            
            this.elements.analysisConfirmation.addEventListener('click', handleBackdropClick);
            console.log('✅ Backdrop click handler attached');
        }, 100);
        
        // Animate panel entrance
        if (typeof anime !== 'undefined') {
            const content = this.elements.analysisConfirmation.querySelector('.analysis-confirmation-content');
            if (content) {
                anime({
                    targets: content,
                    scale: [0.8, 1],
                    opacity: [0, 1],
                    duration: 800,
                    easing: 'easeOutElastic(1, .8)'
                });
            }
        }
        
        console.log('📊 Analysis confirmation shown with animations');
    }
    
    /**
     * Fallback notification when analysis confirmation panel fails
     */
    showAnalysisCompleteFallback(data) {
        console.log('📊 Showing fallback analysis complete notification');
        
        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = 'analysis-complete-notification';
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        const blobCount = data.blobs ? data.blobs.length : 0;
        notification.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 15px;">✨ Analysis Complete!</div>
            <div style="font-size: 16px; margin-bottom: 20px;">
                ${blobCount} emotion${blobCount !== 1 ? 's' : ''} captured and added to your landscape
            </div>
            <button onclick="this.parentElement.remove()" style="
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
            ">Continue</button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    /**
     * Populate analysis confirmation with actual data
     */
    populateAnalysisData(data) {
        const blobs = data.blobs || [];
        const summary = data.processing_summary || {};

        console.log("Populating analysis panel with data:", data);

        // Calculate overall metrics
        const utteranceCount = blobs.length;
        const emotionCategories = [...new Set(blobs.map(b => b.category))];
        const emotionCount = emotionCategories.length;
        const avgConfidence = utteranceCount > 0 ? 
            blobs.reduce((sum, b) => sum + (b.confidence || 0), 0) / utteranceCount : 0;
        
        // --- Populate New Metrics ---
        this.animateCounter(document.getElementById('analysis-utterances'), 0, utteranceCount, 1200);
        this.animateCounter(document.getElementById('analysis-emotions'), 0, emotionCount, 1200);
        this.animateCounter(document.getElementById('analysis-confidence'), 0, Math.round(avgConfidence * 100), 1200, '%');

        // --- Populate Emotion List ---
        const emotionListEl = document.getElementById('analysis-emotion-list');
        if (emotionListEl && utteranceCount > 0) {
            const emotionCounts = {};
            blobs.forEach(blob => {
                const category = blob.category || 'unknown';
                emotionCounts[category] = (emotionCounts[category] || 0) + 1;
            });

            emotionListEl.innerHTML = Object.entries(emotionCounts)
                .sort(([,a],[,b]) => b - a) // Sort by count descending
                .map(([emotion, count]) => `
                    <div class="analysis-emotion-item ${emotion}">
                        <div class="emotion-dot"></div>
                        <span class="emotion-name">${emotion.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                        <span class="emotion-count">${count}</span>
                    </div>
                `).join('');
        }
        
        // --- Populate Detailed Explanation ---
        const explanationEl = document.getElementById('analysis-explanation');
        if (explanationEl) {
            explanationEl.innerHTML = this.generateDetailedExplanation(blobs, emotionCategories);
        }
        
        // ENHANCED: Update global blob stats to sync with new data
        this.updateBlobStats(blobs);
    }

    generateDetailedExplanation(blobs, emotionCategories) {
        if (blobs.length === 0) {
            return "<p>The analysis didn't find any distinct emotional segments in this recording. Try speaking for a bit longer and more clearly.</p>";
        }

        const primaryEmotion = emotionCategories[0] || 'neutral';
        const totalScore = blobs.reduce((sum, b) => sum + b.score, 0);
        const avgScore = totalScore / blobs.length;

        let title = "A Moment of Reflection";
        let body = "";

        if (avgScore > 0.3) title = "A Journey of Hope";
        else if (avgScore < -0.2) title = "A Story of Sorrow";
        else if (emotionCategories.includes('ambivalent') || emotionCategories.includes('transformative')) {
            title = "A Complex Emotional Landscape";
        }

        const hopeCount = blobs.filter(b => b.category === 'hope').length;
        const sorrowCount = blobs.filter(b => b.category === 'sorrow').length;
        const transformativeCount = blobs.filter(b => b.category === 'transformative').length;

        if (transformativeCount > 0 && (hopeCount > 0 || sorrowCount > 0)) {
            body = `Your voice carries a narrative of transformation, turning moments of ${sorrowCount > 0 ? 'sorrow' : 'reflection'} into newfound strength and hope. `;
        } else if (hopeCount > sorrowCount) {
            body = `A sense of optimism shines through your words. The analysis highlights themes of aspiration and resilience, suggesting a hopeful outlook. `;
        } else if (sorrowCount > hopeCount) {
            body = `The recording holds a tone of deep reflection, touching on challenges and moments of sorrow. This suggests a period of introspection and processing. `;
        } else {
            body = `Your expression appears balanced, containing a mix of different feelings without a single dominant theme. This points to a multifaceted emotional state. `;
        }
        
        body += `The AI detected ${emotionCategories.length} distinct emotional states, indicating a rich and varied inner world during this brief recording.`;

        return `<h4>${title}</h4><p>${body}</p>`;
    }

    animateCounter(element, from, to, duration = 1000, suffix = '') {
        if (typeof anime !== 'undefined') {
            const obj = { value: from };
            anime({
                targets: obj,
                value: to,
                duration: duration,
                easing: 'easeOutCubic',
                update: () => {
                    element.textContent = Math.round(obj.value) + suffix;
                }
            });
        } else {
            // Fallback without animation
            element.textContent = to + suffix;
        }
    }
    
    hideAnalysisConfirmation() {
        console.log('🎯 Hiding analysis confirmation');
        if (this.elements.analysisConfirmation) {
            this.elements.analysisConfirmation.classList.remove('visible');
            console.log('✅ Analysis confirmation hidden');
            
            // Remove blob highlights 5 seconds after panel closes
            setTimeout(() => {
                console.log('🕒 5 seconds elapsed, removing blob highlights');
                this.removeNewBlobHighlights();
            }, 5000);
        } else {
            console.warn('⚠️ Analysis confirmation element not found');
        }
    }
    
    /**
     * Hide instructions panel
     */
    hideInstructions() {
        const instructionsPanel = document.querySelector('.instructions-panel');
        if (instructionsPanel) {
            instructionsPanel.classList.add('hidden');
        }
    }
    
    /**
     * Toggle blob info panel
     */
    toggleBlobInfo() {
        if (this.elements.blobInfoPanel && this.elements.blobInfoToggle) {
            const isActive = this.elements.blobInfoPanel.classList.contains('active');
            
            if (isActive) {
                // Hide panel
                this.elements.blobInfoPanel.classList.remove('active');
                this.elements.blobInfoToggle.classList.remove('active');
                console.log('🎨 Blob info panel hidden');
            } else {
                // Show panel
                this.elements.blobInfoPanel.classList.add('active');
                this.elements.blobInfoToggle.classList.add('active');
                this.updateBlobStats();
                console.log('🎨 Blob info panel shown');
            }
        }
    }
    
    /**
     * Update blob statistics
     */
    updateBlobStats(blobs = null) {
        console.log('📊 Updating blob stats...');
        
        // If no blobs provided, get them from visualizer
        if (!blobs && this.emotionVisualizer && this.emotionVisualizer.getBlobs) {
            blobs = this.emotionVisualizer.getBlobs();
            console.log(`📊 Retrieved ${blobs ? blobs.length : 0} blobs from visualizer`);
        }
        
        if (!blobs || !Array.isArray(blobs)) {
            console.warn('⚠️ No valid blobs data for stats update, setting counts to 0');
            blobs = []; // Ensure it's an empty array for consistent processing
        }
        
        console.log(`📊 Processing ${blobs.length} blobs for stats`);
        
        // Update total count
        if (this.elements.blobCount) {
            this.elements.blobCount.textContent = blobs.length;
            console.log(`📊 Updated blob counter to: ${blobs.length}`);
        } else {
            console.warn('⚠️ Blob count element not found');
        }
        
        // Update category counts - handle both uppercase and lowercase
        const categoryCounts = {
            hope: 0,
            sorrow: 0,
            transformative: 0,
            ambivalent: 0,
            reflective_neutral: 0
        };
        
        // Count categories from blobs
        blobs.forEach(blob => {
            const category = blob.category ? blob.category.toLowerCase() : '';
            if (categoryCounts.hasOwnProperty(category)) {
                categoryCounts[category]++;
            } else if (category) {
                console.warn(`⚠️ Unknown category found: ${category}`);
            }
        });
        
        // Update category stat displays by ID
        const categoryElements = {
            hope: document.getElementById('hope-count'),
            sorrow: document.getElementById('sorrow-count'),
            transformative: document.getElementById('transformative-count'),
            ambivalent: document.getElementById('ambivalent-count'),
            reflective_neutral: document.getElementById('reflective-neutral-count')
        };
        
        // ENHANCED: Update each category count and provide debugging
        Object.keys(categoryCounts).forEach(category => {
            const element = categoryElements[category];
            const count = categoryCounts[category];
            if (element) {
                element.textContent = count;
                console.log(`📊 Updated ${category} count to: ${count}`);
            } else {
                console.warn(`⚠️ Category element not found for: ${category}`);
            }
        });
        
        // ENHANCED: Calculate confidence and voice segments
        if (blobs.length > 0) {
            const avgConfidence = blobs.reduce((sum, blob) => sum + (blob.confidence || 0), 0) / blobs.length;
            const confidencePercent = Math.round(avgConfidence * 100);
            
            // Update confidence display - FIXED: Target correct elements
            const confidenceElements = [
                '#analysis-confidence',          // Analysis confirmation panel
                '.confidence-value', 
                '#ai-confidence'
            ];
            confidenceElements.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    element.textContent = `${confidencePercent}%`;
                    console.log(`📊 Updated AI confidence (${selector}) to: ${confidencePercent}%`);
                }
            });
            
            // Update voice segments count - FIXED: Target correct elements  
            const segmentsElements = [
                '#analysis-utterances',          // Analysis confirmation panel
                '.segments-value', 
                '#voice-segments'
            ];
            segmentsElements.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    element.textContent = blobs.length;
                    console.log(`📊 Updated voice segments (${selector}) to: ${blobs.length}`);
                }
            });
            
            // Update detected emotions count - FIXED: Target correct elements
            const uniqueCategories = Object.values(categoryCounts).filter(count => count > 0).length;
            const emotionsElements = [
                '#analysis-emotions',            // Analysis confirmation panel
                '.emotions-value', 
                '#detected-emotions'
            ];
            emotionsElements.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    element.textContent = uniqueCategories;
                    console.log(`📊 Updated detected emotions (${selector}) to: ${uniqueCategories}`);
                }
            });
        } else {
            // Set all metrics to 0 when no blobs - FIXED: Target correct elements
            const zeroElements = [
                // Analysis confirmation panel elements
                '#analysis-confidence',
                '#analysis-utterances', 
                '#analysis-emotions',
                // Fallback elements
                '.confidence-value', '#ai-confidence',
                '.segments-value', '#voice-segments',
                '.emotions-value', '#detected-emotions'
            ];
            
            zeroElements.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    if (selector.includes('confidence')) {
                        element.textContent = '0%';
                    } else {
                        element.textContent = '0';
                    }
                }
            });
            
            console.log('📊 Set all metrics to 0 (no blobs)');
        }
        
        console.log('📊 Final blob stats:', categoryCounts);
        console.log('📊 Stats update complete');
    }
    
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Check if click is on UI element
     */
    isClickOnUIElement(event) {
        const uiSelectors = [
            '.recording-interface',
            '.blob-info-panel',
            '.blob-info-toggle',
            '.processing-panel',
            '.error-panel',
            '.analysis-confirmation',
            '.nav-bar'
        ];
        
        return uiSelectors.some(selector => {
            const element = document.querySelector(selector);
            return element && element.contains(event.target);
        });
    }
    
    /**
     * Update blob count (for single additions)
     */
    async updateBlobCount() {
        try {
            const response = await fetch('/api/get_all_blobs');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.blobs) {
                    this.updateBlobStats(data.blobs);
                }
            }
        } catch (error) {
            console.error('❌ Failed to update blob count:', error);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 DOM loaded, initializing Hopes & Sorrows App...');
    window.hopesSorrowsApp = new HopesSorrowsApp();
});

// Export for global access
window.HopesSorrowsApp = HopesSorrowsApp; 