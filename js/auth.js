class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // Listen for auth state changes
        firebase.auth().onAuthStateChanged((user) => {
            this.currentUser = user;
            this.updateUI();
            
            if (user) {
                console.log("User logged in:", user.email);
                this.updateUserData(user);
            } else {
                console.log("User logged out");
            }
        });
    }

    // تسجيل الدخول
    async login(email, password) {
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // إنشاء حساب جديد
    async register(name, email, password) {
        try {
            // Create auth account
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Create user document in Firestore
            await firebase.db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                subscription: 'free',
                credits: 0,
                phone: '',
                favoriteNovels: [],
                purchasedNovels: []
            });
            
            return { success: true, user: user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // تسجيل الخروج
    async logout() {
        try {
            await firebase.auth().signOut();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // تحديث واجهة المستخدم بناءً على حالة الدخول
    updateUI() {
        const userActions = document.getElementById('userActions');
        if (!userActions) return;

        if (this.currentUser) {
            userActions.innerHTML = `
                <div class="user-dropdown">
                    <button class="btn btn-secondary" onclick="window.location.href='dashboard.html'">
                        <i class="fas fa-user"></i> حسابي
                    </button>
                    <button class="btn btn-primary" onclick="authManager.logout()">
                        <i class="fas fa-sign-out-alt"></i> تسجيل خروج
                    </button>
                </div>
            `;
        } else {
            userActions.innerHTML = `
                <button class="btn btn-secondary" onclick="window.location.href='login.html'">
                    <i class="fas fa-sign-in-alt"></i> تسجيل الدخول
                </button>
                <button class="btn btn-primary" onclick="window.location.href='register.html'">
                    <i class="fas fa-user-plus"></i> إنشاء حساب
                </button>
            `;
        }
    }

    // تحديث بيانات المستخدم
    async updateUserData(user) {
        try {
            const userDoc = await firebase.db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                localStorage.setItem('userData', JSON.stringify(userDoc.data()));
            }
        } catch (error) {
            console.error("Error updating user data:", error);
        }
    }

    // الحصول على بيانات المستخدم الحالي
    getUserData() {
        const stored = localStorage.getItem('userData');
        return stored ? JSON.parse(stored) : null;
    }

    // التحقق من صلاحيات المستخدم
    hasRole(requiredRole) {
        const userData = this.getUserData();
        return userData && userData.role === requiredRole;
    }

    // تحديث بيانات المستخدم
    async updateProfile(data) {
        try {
            const user = this.currentUser;
            if (!user) return { success: false, error: "Not authenticated" };

            await firebase.db.collection('users').doc(user.uid).update(data);
            
            // Update local storage
            const currentData = this.getUserData();
            const updatedData = { ...currentData, ...data };
            localStorage.setItem('userData', JSON.stringify(updatedData));
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Initialize auth manager
window.authManager = new AuthManager();
