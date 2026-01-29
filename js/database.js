،class DatabaseManager {
    constructor() {
        this.db = firebase.db;
        this.storage = firebase.storage;
    }

    // ============== NOVELS MANAGEMENT ==============
    
    // الحصول على جميع الروايات
    async getAllNovels(limit = 20) {
        try {
            const snapshot = await this.db.collection('novels')
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting novels:", error);
            return [];
        }
    }

    // الحصول على الروايات المميزة
    async getFeaturedNovels() {
        try {
            const snapshot = await this.db.collection('novels')
                .where('featured', '==', true)
                .limit(8)
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting featured novels:", error);
            return [];
        }
    }

    // إضافة رواية جديدة
    async addNovel(novelData) {
        try {
            const user = authManager.currentUser;
            if (!user) return { success: false, error: "Not authenticated" };

            const novelWithMeta = {
                ...novelData,
                authorId: user.uid,
                authorName: authManager.getUserData()?.name || "مجهول",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                downloads: 0,
                views: 0,
                rating: 0,
                reviews: 0,
                status: 'pending', // pending, approved, rejected
                featured: false
            };

            const docRef = await this.db.collection('novels').add(novelWithMeta);
            return { success: true, id: docRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // تحديث رواية
    async updateNovel(novelId, data) {
        try {
            await this.db.collection('novels').doc(novelId).update({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // حذف رواية
    async deleteNovel(novelId) {
        try {
            await this.db.collection('novels').doc(novelId).delete();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // البحث عن روايات
    async searchNovels(query) {
        try {
            const snapshot = await this.db.collection('novels')
                .orderBy('title')
                .startAt(query)
                .endAt(query + '\uf8ff')
                .limit(20)
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error searching novels:", error);
            return [];
        }
    }

    // ============== PDF UPLOAD ==============
    
    // رفع ملف PDF
    async uploadPDF(file, novelId) {
        try {
            const user = authManager.currentUser;
            if (!user) return { success: false, error: "Not authenticated" };

            // Create storage reference
            const storageRef = this.storage.ref();
            const pdfRef = storageRef.child(`novels/${novelId}/${file.name}`);
            
            // Upload file
            const uploadTask = pdfRef.put(file);
            
            return new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        // Progress monitoring
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log('Upload progress: ' + progress + '%');
                    },
                    (error) => {
                        reject({ success: false, error: error.message });
                    },
                    async () => {
                        // Upload complete
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        
                        // Update novel with PDF URL
                        await this.updateNovel(novelId, {
                            pdfUrl: downloadURL,
                            fileSize: file.size,
                            fileName: file.name
                        });
                        
                        resolve({ 
                            success: true, 
                            url: downloadURL,
                            fileName: file.name 
                        });
                    }
                );
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============== PAYMENT & CODES ==============
    
    // إنشاء كود خصم/دفع
    async createPromoCode(codeData) {
        try {
            const user = authManager.currentUser;
            if (!user || !authManager.hasRole('admin')) {
                return { success: false, error: "Unauthorized" };
            }

            const codeWithMeta = {
                ...codeData,
                createdBy: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                used: false,
                usedBy: null,
                usedAt: null
            };

            const docRef = await this.db.collection('promoCodes').add(codeWithMeta);
            return { success: true, id: docRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // التحقق من كود الخصم
    async validatePromoCode(code, userId) {
        try {
            const snapshot = await this.db.collection('promoCodes')
                .where('code', '==', code)
                .where('used', '==', false)
                .limit(1)
                .get();
            
            if (snapshot.empty) {
                return { success: false, error: "كود غير صالح أو منتهي الصلاحية" };
            }

            const codeDoc = snapshot.docs[0];
            const codeData = codeDoc.data();
            
            // Check expiration
            if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) {
                return { success: false, error: "الكود منتهي الصلاحية" };
            }

            return { 
                success: true, 
                data: codeData,
                id: codeDoc.id 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // استخدام كود الخصم
    async usePromoCode(codeId, userId, novelId) {
        try {
            const batch = this.db.batch();
            
            // Mark code as used
            const codeRef = this.db.collection('promoCodes').doc(codeId);
            batch.update(codeRef, {
                used: true,
                usedBy: userId,
                usedAt: firebase.firestore.FieldValue.serverTimestamp(),
                usedFor: novelId
            });
            
            // Add novel to user's purchased novels
            const userRef = this.db.collection('users').doc(userId);
            batch.update(userRef, {
                purchasedNovels: firebase.firestore.FieldValue.arrayUnion(novelId)
            });
            
            // Increment novel sales
            const novelRef = this.db.collection('novels').doc(novelId);
            batch.update(novelRef, {
                sales: firebase.firestore.FieldValue.increment(1)
            });
            
            await batch.commit();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============== USER MANAGEMENT ==============
    
    // الحصول على جميع المستخدمين
    async getAllUsers() {
        try {
            if (!authManager.hasRole('admin')) {
                return { success: false, error: "Unauthorized" };
            }

            const snapshot = await this.db.collection('users').get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting users:", error);
            return [];
        }
    }

    // تحديث دور المستخدم
    async updateUserRole(userId, role) {
        try {
            if (!authManager.hasRole('admin')) {
                return { success: false, error: "Unauthorized" };
            }

            await this.db.collection('users').doc(userId).update({
                role: role,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============== STATISTICS ==============
    
    // الحصول على إحصائيات الموقع
    async getSiteStats() {
        try {
            if (!authManager.hasRole('admin')) {
                return null;
            }

            const [novelsSnapshot, usersSnapshot, codesSnapshot] = await Promise.all([
                this.db.collection('novels').get(),
                this.db.collection('users').get(),
                this.db.collection('promoCodes').get()
            ]);

            const totalDownloads = novelsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().downloads || 0), 0);
            const totalSales = novelsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().sales || 0), 0);

            return {
                totalNovels: novelsSnapshot.size,
                totalUsers: usersSnapshot.size,
                totalCodes: codesSnapshot.size,
                activeCodes: codesSnapshot.docs.filter(doc => !doc.data().used).length,
                totalDownloads: totalDownloads,
                totalSales: totalSales
            };
        } catch (error) {
            console.error("Error getting stats:", error);
            return null;
        }
    }
}

// Initialize database manager
window.dbManager = new DatabaseManager();
