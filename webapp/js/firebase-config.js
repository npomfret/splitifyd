class FirebaseConfigManager {
    constructor() {
        this.config = null;
        this.initialized = false;
        this.app = null;
        this.auth = null;
    }

    async initialize() {
        if (this.initialized) {
            return this.config;
        }

        try {
            const firebaseConfig = await this.fetchFirebaseConfig();
            
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { 
                getAuth, 
                connectAuthEmulator,
                signInWithEmailAndPassword,
                createUserWithEmailAndPassword,
                signOut,
                onAuthStateChanged
            } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            
            this.app = initializeApp(firebaseConfig);
            this.auth = getAuth(this.app);
            
            if (this.isLocalEnvironment()) {
                console.log('🔧 Connecting to Firebase Auth emulator at localhost:9099');
                connectAuthEmulator(this.auth, 'http://localhost:9099', { disableWarnings: true });
            }
            
            window.firebaseAuth = {
                signInWithEmailAndPassword: (email, password) => 
                    signInWithEmailAndPassword(this.auth, email, password),
                createUserWithEmailAndPassword: (email, password) => 
                    createUserWithEmailAndPassword(this.auth, email, password),
                signOut: () => signOut(this.auth),
                onAuthStateChanged: (callback) => onAuthStateChanged(this.auth, callback),
                getCurrentUser: () => this.auth.currentUser
            };
            
            this.initialized = true;
            console.log('Firebase initialized successfully');
            
            return this.config;
            
        } catch (error) {
            console.error('Failed to initialize Firebase:', error);
            throw new Error(`Firebase initialization failed: ${error.message}`);
        }
    }

    async fetchFirebaseConfig() {
        const configUrl = this.getConfigUrl();
        console.log('Fetching Firebase configuration from:', configUrl);
        
        try {
            const response = await fetch(configUrl);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Failed to fetch config: ${response.status}`);
            }
            
            const firebaseConfig = await response.json();
            console.log('Firebase configuration loaded:', { projectId: firebaseConfig.projectId });
            
            this.config = {
                firebaseConfig,
                apiUrl: this.getApiUrlForProject(firebaseConfig.projectId),
                isLocal: this.isLocalEnvironment()
            };
            
            return firebaseConfig;
            
        } catch (error) {
            console.error('Config fetch failed:', error);
            
            if (this.isLocalEnvironment()) {
                console.warn('Falling back to default local configuration');
                const defaultConfig = {
                    projectId: 'splitifyd',
                    apiKey: 'demo-api-key',
                    authDomain: 'splitifyd.firebaseapp.com',
                    storageBucket: 'splitifyd.appspot.com',
                    messagingSenderId: '123456789',
                    appId: 'demo-app-id'
                };
                
                this.config = {
                    firebaseConfig: defaultConfig,
                    apiUrl: this.getApiUrlForProject(defaultConfig.projectId),
                    isLocal: true
                };
                
                return defaultConfig;
            }
            
            throw error;
        }
    }

    isLocalEnvironment() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1';
    }

    getConfigUrl() {
        const localHost = window.location.hostname;
        const LOCAL_FUNCTIONS_PORT = 5001;
        
        if (this.isLocalEnvironment()) {
            return `http://${localHost}:${LOCAL_FUNCTIONS_PORT}/splitifyd/us-central1/api/config`;
        }
        
        const protocol = window.location.protocol;
        const host = window.location.host;
        return `${protocol}//${host}/api/config`;
    }

    getApiUrlForProject(projectId = 'splitifyd') {
        const localHost = window.location.hostname;
        const LOCAL_FUNCTIONS_PORT = 5001;
        
        if (this.isLocalEnvironment()) {
            return `http://${localHost}:${LOCAL_FUNCTIONS_PORT}/${projectId}/us-central1/api`;
        }
        
        const protocol = window.location.protocol;
        const host = window.location.host;
        return `${protocol}//${host}/api`;
    }

    getConfig() {
        if (!this.config) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.config;
    }

    getApiUrl() {
        return this.getConfig().apiUrl;
    }

    isInitialized() {
        return this.initialized;
    }
}

window.firebaseConfigManager = new FirebaseConfigManager();