// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBCMpT78Zg3HfYvkbadFreYU_FShA0t_EA",
  authDomain: "splitifyd.firebaseapp.com",
  projectId: "splitifyd",
  storageBucket: "splitifyd.firebasestorage.app",
  messagingSenderId: "501123495201",
  appId: "1:501123495201:web:10e655bbbe9842226dfa60",
  measurementId: "G-GFHKC94PRE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5001/YOUR_PROJECT_ID/us-central1'
  : `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net`;

// Global variables
let currentUser = null;
let authToken = null;

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
    await createUserWithEmailAndPassword(auth, email, password);
    showMessage('Account created successfully');
  } catch (error) {
    showMessage(error.message, 'error');
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

// Auth state observer
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  
  if (user) {
    // Get the ID token
    authToken = await user.getIdToken();
    
    // Refresh token every 55 minutes
    setInterval(async () => {
      authToken = await user.getIdToken(true);
    }, 55 * 60 * 1000);
    
    showUserInfo();
  } else {
    authToken = null;
    showAuthForm('login');
    elements.documentSection.style.display = 'none';
  }
});