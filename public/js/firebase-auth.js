// firebase-auth.js
const API_KEY = "AIzaSyCFgslM9FY0UmUWq9Jzqhq46XnFvmIpzP0"; // 就用你Java里的

// 通用的 post
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

// 登录
async function fbSignIn(email, password) {
    const data = await firebasePost("accounts:signInWithPassword", {
        email,
        password,
        returnSecureToken: true,
    });
    // data 里有 idToken / email / refreshToken / localId
    // 为了跟 Dashboard 通讯，我们存一下
    const user = {
        email: data.email,
        idToken: data.idToken,
    };
    localStorage.setItem("currentUser", JSON.stringify(user));
    return user;
}

// 注册
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

// 发重置密码邮件
async function fbSendReset(email) {
    await firebasePost("accounts:sendOobCode", {
        requestType: "PASSWORD_RESET",
        email,
    });
}

// 发验证邮箱
async function fbSendVerify(idToken) {
    await firebasePost("accounts:sendOobCode", {
        requestType: "VERIFY_EMAIL",
        idToken,
    });
}

// 查最新用户信息（看邮箱到底 verify 没）
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

// 读当前登录用户
function fbGetCurrentUser() {
    const raw = localStorage.getItem("currentUser");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// 退出
function fbSignOut() {
    localStorage.removeItem("currentUser");
}
