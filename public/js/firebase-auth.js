// firebase-auth.js
const API_KEY = "AIzaSyCFgslM9FY0UmUWq9Jzqhq46XnFvmIpzP0"; // Use the same one as your Java app

// Shared POST helper
async function firebasePost(endpoint, bodyObj) {
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
    });
    const data = await resp.json();
    if (!resp.ok) {
        throw new Error(data.error?.message || "Firebase error");
    }
    return data;
}

// Sign in
async function fbSignIn(email, password) {
    const data = await firebasePost("accounts:signInWithPassword", {
        email,
        password,
        returnSecureToken: true,
    });
    // data includes idToken / email / refreshToken / localId
    // Store it for dashboard usage
    const user = {
        email: data.email,
        idToken: data.idToken,
    };
    localStorage.setItem("currentUser", JSON.stringify(user));
    return user;
}

// Sign up
async function fbSignUp(email, password) {
    const data = await firebasePost("accounts:signUp", {
        email,
        password,
        returnSecureToken: true,
    });
    const user = {
        email: data.email,
        idToken: data.idToken,
    };
    localStorage.setItem("currentUser", JSON.stringify(user));
    return user;
}

// Send reset password email
async function fbSendReset(email) {
    await firebasePost("accounts:sendOobCode", {
        requestType: "PASSWORD_RESET",
        email,
    });
}

// Send verification email
async function fbSendVerify(idToken) {
    await firebasePost("accounts:sendOobCode", {
        requestType: "VERIFY_EMAIL",
        idToken,
    });
}

// Fetch latest user info (check if email is verified)
async function fbLookup(idToken) {
    const data = await firebasePost("accounts:lookup", {
        idToken,
    });
    const user0 = data.users?.[0];
    return {
        email: user0?.email,
        emailVerified: user0?.emailVerified || false,
    };
}

// Read current signed-in user
function fbGetCurrentUser() {
    const raw = localStorage.getItem("currentUser");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Sign out
function fbSignOut() {
    localStorage.removeItem("currentUser");
}
