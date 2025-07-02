// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// https://firebase.google.com/docs/web/setup#available-libraries

// API Configuration  
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Firebase configuration will be loaded dynamically
let firebaseConfig = null;
let app = null;
let auth = null;
let googleProvider = null;

// Initialize Firebase asynchronously
async function initializeFirebase() {
  try {
    // Determine the config endpoint URL
    const configUrl = isLocal
      ? `http://localhost:5001/splitifyd/us-central1/configFn`
      : `https://us-central1-splitifyd.cloudfunctions.net/configFn`;
    
    console.log('Fetching Firebase configuration from:', configUrl);
    
    // Fetch Firebase configuration from backend
    const response = await fetch(configUrl);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to fetch Firebase config: ${response.status}`);
    }
    
    firebaseConfig = await response.json();
    console.log('Firebase configuration loaded:', { projectId: firebaseConfig.projectId });
    
    // Initialize Firebase with fetched configuration
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    // Connect to auth emulator if running locally
    if (isLocal) {
      console.log('🔧 Connecting to Firebase Auth emulator at localhost:9099');
      connectAuthEmulator(auth, 'http://localhost:9099');
    }
    
    // Return true to indicate successful initialization
    return true;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    showMessage('Failed to load application configuration. Please refresh the page.', 'error');
    return false;
  }
}

// API Base URL will be set after Firebase is initialized
let API_BASE_URL = null;

// Global variables
let currentUser = null;
let authToken = null;

// Update debug panel
function updateDebugPanel() {
  document.getElementById('debug-hostname').textContent = window.location.hostname + ':' + window.location.port;
  document.getElementById('debug-is-local').textContent = isLocal ? 'YES' : 'NO';
  document.getElementById('debug-api-url').textContent = API_BASE_URL || 'Not initialized';
  document.getElementById('debug-project-id').textContent = firebaseConfig?.projectId || 'Not loaded';
  document.getElementById('debug-auth-token').textContent = authToken ? `Present (${authToken.length} chars)` : 'Not available';
  document.getElementById('debug-current-user').textContent = currentUser ? `${currentUser.email} (${currentUser.uid.substring(0, 8)}...)` : 'Not signed in';
}

// DOM Elements
const elements = {
  // Auth elements
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  userInfo: document.getElementById('user-info'),
  userEmail: document.getElementById('user-email'),
  showRegister: document.getElementById('show-register'),
  showLogin: document.getElementById('show-login'),
  
  // Document elements
  documentSection: document.getElementById('document-section'),
  jsonEditor: document.getElementById('json-editor'),
  jsonPreview: document.getElementById('json-preview'),
  documentId: document.getElementById('document-id'),
  documentsContainer: document.getElementById('documents-container'),
  messageContainer: document.getElementById('message-container'),
  loading: document.getElementById('loading')
};

// Utility Functions
function showLoading() {
  elements.loading.style.display = 'flex';
}

function hideLoading() {
  elements.loading.style.display = 'none';
}

function showMessage(message, type = 'success') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = message;
  
  elements.messageContainer.innerHTML = '';
  elements.messageContainer.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

function formatJSON() {
  try {
    const json = JSON.parse(elements.jsonEditor.value);
    elements.jsonEditor.value = JSON.stringify(json, null, 2);
    updateJSONPreview();
  } catch (error) {
    showMessage('Invalid JSON format', 'error');
  }
}

function updateJSONPreview() {
  try {
    const json = JSON.parse(elements.jsonEditor.value);
    const formatted = JSON.stringify(json, null, 2);
    elements.jsonPreview.innerHTML = `<pre><code class="language-json">${escapeHtml(formatted)}</code></pre>`;
    elements.jsonPreview.style.display = 'block';
    hljs.highlightAll();
  } catch (error) {
    elements.jsonPreview.style.display = 'none';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Local Storage Functions
function saveDraft() {
  const content = elements.jsonEditor.value;
  localStorage.setItem('json-draft', content);
  showMessage('Draft saved to local storage');
}

function loadDraft() {
  const draft = localStorage.getItem('json-draft');
  if (draft) {
    elements.jsonEditor.value = draft;
    updateJSONPreview();
    showMessage('Draft loaded from local storage');
  } else {
    showMessage('No draft found', 'error');
  }
}

// API Functions
async function makeAPICall(endpoint, method = 'GET', body = null) {
  // Ensure we have a fresh token
  if (currentUser && !authToken) {
    console.log('Getting fresh auth token...');
    authToken = await currentUser.getIdToken();
  }
  
  console.log('Making API call:', method, `${API_BASE_URL}/${endpoint}`);
  console.log('Auth token present:', !!authToken);
  console.log('Token length:', authToken ? authToken.length : 0);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    console.error('API call failed:', response.status, data);
    throw new Error(data.error?.message || 'API call failed');
  }
  
  return data;
}

async function createDocument() {
  try {
    showLoading();
    const data = JSON.parse(elements.jsonEditor.value);
    const result = await makeAPICall('createDocumentFn', 'POST', { data });
    showMessage(`Document created with ID: ${result.id}`);
    elements.documentId.value = result.id;
    refreshDocumentList();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function getDocument() {
  const id = elements.documentId.value.trim();
  if (!id) {
    showMessage('Please enter a document ID', 'error');
    return;
  }
  
  try {
    showLoading();
    const result = await makeAPICall(`getDocumentFn?id=${id}`);
    elements.jsonEditor.value = JSON.stringify(result.data, null, 2);
    updateJSONPreview();
    showMessage('Document loaded successfully');
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function updateDocument() {
  const id = elements.documentId.value.trim();
  if (!id) {
    showMessage('Please enter a document ID', 'error');
    return;
  }
  
  try {
    showLoading();
    const data = JSON.parse(elements.jsonEditor.value);
    await makeAPICall(`updateDocumentFn?id=${id}`, 'PUT', { data });
    showMessage('Document updated successfully');
    refreshDocumentList();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteDocument() {
  const id = elements.documentId.value.trim();
  if (!id) {
    showMessage('Please enter a document ID', 'error');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this document?')) {
    return;
  }
  
  try {
    showLoading();
    await makeAPICall(`deleteDocumentFn?id=${id}`, 'DELETE');
    showMessage('Document deleted successfully');
    elements.documentId.value = '';
    elements.jsonEditor.value = '';
    updateJSONPreview();
    refreshDocumentList();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function refreshDocumentList() {
  try {
    showLoading();
    const result = await makeAPICall('listDocumentsFn');
    displayDocuments(result.documents);
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    hideLoading();
  }
}

function displayDocuments(documents) {
  if (documents.length === 0) {
    elements.documentsContainer.innerHTML = '<p>No documents found</p>';
    return;
  }
  
  elements.documentsContainer.innerHTML = documents.map(doc => `
    <div class="document-item" data-id="${doc.id}">
      <h4>Document ID: ${doc.id}</h4>
      <div class="document-meta">
        Created: ${new Date(doc.createdAt).toLocaleString()}<br>
        Updated: ${new Date(doc.updatedAt).toLocaleString()}
      </div>
      <div class="document-preview">${doc.preview}</div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.document-item').forEach(item => {
    item.addEventListener('click', () => {
      elements.documentId.value = item.dataset.id;
      getDocument();
    });
  });
}

// Authentication Functions
function showAuthForm(form) {
  elements.loginForm.style.display = form === 'login' ? 'block' : 'none';
  elements.registerForm.style.display = form === 'register' ? 'block' : 'none';
  elements.userInfo.style.display = 'none';
}

function showUserInfo() {
  elements.loginForm.style.display = 'none';
  elements.registerForm.style.display = 'none';
  elements.userInfo.style.display = 'block';
  elements.userEmail.textContent = currentUser.email || 'Unknown';
  elements.documentSection.style.display = 'block';
  refreshDocumentList();
}

// Event Listeners
// Auth form switches
elements.showRegister.addEventListener('click', (e) => {
  e.preventDefault();
  showAuthForm('register');
});

elements.showLogin.addEventListener('click', (e) => {
  e.preventDefault();
  showAuthForm('login');
});

// Email login
document.getElementById('email-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    showLoading();
    await signInWithEmailAndPassword(auth, email, password);
    showMessage('Signed in successfully');
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    hideLoading();
  }
});

// Email registration
document.getElementById('email-register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirm = document.getElementById('register-confirm').value;
  
  if (password !== confirm) {
    showMessage('Passwords do not match', 'error');
    return;
  }
  
  try {
    showLoading();
    console.log('Attempting to create user with email:', email);
    await createUserWithEmailAndPassword(auth, email, password);
    showMessage('Account created successfully');
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    showMessage(`Registration failed: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
});

// Google sign in
document.getElementById('google-signin').addEventListener('click', async () => {
  try {
    showLoading();
    await signInWithPopup(auth, googleProvider);
    showMessage('Signed in with Google successfully');
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    hideLoading();
  }
});

// Sign out
document.getElementById('sign-out').addEventListener('click', async () => {
  try {
    await signOut(auth);
    showMessage('Signed out successfully');
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

// Document operations
document.getElementById('format-json').addEventListener('click', formatJSON);
document.getElementById('clear-editor').addEventListener('click', () => {
  elements.jsonEditor.value = '';
  updateJSONPreview();
});
document.getElementById('save-draft').addEventListener('click', saveDraft);
document.getElementById('load-draft').addEventListener('click', loadDraft);
document.getElementById('create-document').addEventListener('click', createDocument);
document.getElementById('get-document').addEventListener('click', getDocument);
document.getElementById('update-document').addEventListener('click', updateDocument);
document.getElementById('delete-document').addEventListener('click', deleteDocument);
document.getElementById('refresh-list').addEventListener('click', refreshDocumentList);

// JSON editor change
elements.jsonEditor.addEventListener('input', updateJSONPreview);

// Initialize the application
async function initializeApplication() {
  showLoading();
  
  // Initialize Firebase
  const initialized = await initializeFirebase();
  if (!initialized) {
    hideLoading();
    return;
  }
  
  // Set API Base URL after Firebase is initialized
  API_BASE_URL = isLocal
    ? `http://localhost:5001/${firebaseConfig.projectId}/us-central1`
    : `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net`;
  
  console.log('Current hostname:', window.location.hostname);
  console.log('Is local environment:', isLocal);
  console.log('API Base URL:', API_BASE_URL);
  
  // Update debug panel with loaded configuration
  updateDebugPanel();
  
  // Auth state observer
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    if (user) {
      // Get the ID token
      authToken = await user.getIdToken();
      
      // Refresh token every 55 minutes
      setInterval(async () => {
        authToken = await user.getIdToken(true);
        updateDebugPanel(); // Update debug panel when token refreshes
      }, 55 * 60 * 1000);
      
      showUserInfo();
    } else {
      authToken = null;
      showAuthForm('login');
      elements.documentSection.style.display = 'none';
    }
    
    // Update debug panel whenever auth state changes
    updateDebugPanel();
  });
  
  hideLoading();
}

// Start the application when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
  initializeApplication();
}