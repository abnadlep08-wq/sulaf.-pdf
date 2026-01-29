class AdminManager {
    constructor() {
        this.init();
    }

    async init() {
        // التحقق من صلاحيات المدير
        await this.checkAdminAccess();
        
        // تحميل البيانات
        this.loadDashboard();
        this.loadNovels();
        this.loadUsers();
        this.loadPromoCodes();
        
        // إعداد معالجات الأحداث
        this.setupEventListeners();
    }

    // التحقق من صلاحيات المدير
    async checkAdminAccess() {
        const userData = authManager.getUserData();
        if (!userData || userData.role !== 'admin') {
            alert('ليس لديك صلاحية للوصول إلى لوحة التحكم');
            window.location.href = 'index.html';
            return;
        }
        
        // تحديث اسم المستخدم
        document.getElementById('adminUserName').textContent = userData.name;
    }

    // تحميل لوحة التحكم
    async loadDashboard() {
        const stats = await dbManager.getSiteStats();
        if (!stats) return;

        const statsGrid = document.getElementById('adminStats');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <i class="fas fa-book"></i>
                <div>
                    <h3>${stats.totalNovels}</h3>
                    <p>الروايات</p>
                </div>
            </div>
            <div class="stat-card">
                <i class="fas fa-users"></i>
                <div>
                    <h3>${stats.totalUsers}</h3>
                    <p>المستخدمين</p>
                </div>
            </div>
            <div class="stat-card">
                <i class="fas fa-download"></i>
                <div>
                    <h3>${stats.totalDownloads}</h3>
                    <p>التنزيلات</p>
                </div>
            </div>
            <div class="stat-card">
                <i class="fas fa-shopping-cart"></i>
                <div>
                    <h3>${stats.totalSales}</h3>
                    <p>المبيعات</p>
                </div>
            </div>
            <div class="stat-card">
                <i class="fas fa-ticket-alt"></i>
                <div>
                    <h3>${stats.totalCodes}</h3>
                    <p>الأكواد</p>
                </div>
            </div>
            <div class="stat-card">
                <i class="fas fa-check-circle"></i>
                <div>
                    <h3>${stats.activeCodes}</h3>
                    <p>أكواد نشطة</p>
                </div>
            </div>
        `;
    }

    // تحميل الروايات
    async loadNovels() {
        const novels = await dbManager.getAllNovels(50);
        const table = document.getElementById('novelsTable');
        
        if (novels.length === 0) {
            table.innerHTML = '<tr><td colspan="6">لا توجد روايات</td></tr>';
            return;
        }

        table.innerHTML = novels.map(novel => `
            <tr>
                <td>${novel.title}</td>
                <td>${novel.authorName || 'مجهول'}</td>
                <td>${novel.category || 'غير محدد'}</td>
                <td>
                    <span class="status-badge status-${novel.status || 'pending'}">
                        ${this.getStatusText(novel.status)}
                    </span>
                </td>
                <td>${novel.downloads || 0}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="adminManager.editNovel('${novel.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="adminManager.approveNovel('${novel.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminManager.deleteNovel('${novel.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // تحميل المستخدمين
    async loadUsers() {
        const users = await dbManager.getAllUsers();
        const table = document.getElementById('usersTable');
        
        if (!users || users.length === 0) {
            table.innerHTML = '<tr><td colspan="6">لا يوجد مستخدمين</td></tr>';
            return;
        }

        table.innerHTML = users.map(user => `
            <tr>
                <td>${user.name || 'مجهول'}</td>
                <td>${user.email}</td>
                <td>
                    <select class="role-select" data-user="${user.id}" onchange="adminManager.updateUserRole('${user.id}', this.value)">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>مستخدم</option>
                        <option value="author" ${user.role === 'author' ? 'selected' : ''}>كاتب</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مدير</option>
                    </select>
                </td>
                <td>${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('ar-SA') : 'غير معروف'}</td>
                <td>${user.purchasedNovels ? user.purchasedNovels.length : 0}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="adminManager.viewUser('${user.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // تحميل أكواد الدفع
    async loadPromoCodes() {
        // Note: We'll need to add this method to DatabaseManager
        const codes = await this.getPromoCodes();
        const table = document.getElementById('codesTable');
        
        if (!codes || codes.length === 0) {
            table.innerHTML = '<tr><td colspan="6">لا توجد أكواد</td></tr>';
            return;
        }

        table.innerHTML = codes.map(code => `
            <tr>
                <td><strong>${code.code}</strong></td>
                <td>${code.codeType || 'discount'}</td>
                <td>${code.discountValue} ${code.discountType === 'percentage' ? '%' : 'ر.س'}</td>
                <td>${code.used ? code.usedBy || 'مجهول' : 'لم يستخدم'}</td>
                <td>
                    <span class="status-badge status-${code.used ? 'used' : 'active'}">
                        ${code.used ? 'مستخدم' : 'نشط'}
                    </span>
                </td>
                <td class="actions">
                    ${!code.used ? `
                        <button class="btn btn-sm btn-danger" onclick="adminManager.deleteCode('${code.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    // الحصول على أكواد الدفع
    async getPromoCodes() {
        try {
            const snapshot = await firebase.db.collection('promoCodes')
                .orderBy('createdAt', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting promo codes:", error);
            return [];
        }
    }

    // إعداد معالجات الأحداث
    setupEventListeners() {
        // إنشاء كود جديد
        document.getElementById('createCodeForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const codeData = {
                code: document.getElementById('codeValue').value,
                discountValue: parseFloat(document.getElementById('discountValue').value),
                discountType: document.getElementById('discountType').value,
                codeType: document.getElementById('codeType').value,
                expiresAt: document.getElementById('expiryDate').value ? 
                    new Date(document.getElementById('expiryDate').value) : null,
                maxUses: document.getElementById('maxUses').value || null,
                description: `كود خصم بقيمة ${document.getElementById('discountValue').value}`
            };
            
            const result = await dbManager.createPromoCode(codeData);
            if (result.success) {
                alert('تم إنشاء الكود بنجاح!');
                document.getElementById('createCodeForm').reset();
                this.loadPromoCodes();
            } else {
                alert('خطأ في إنشاء الكود: ' + result.error);
            }
        });

        // رفع رواية جديدة
        document.getElementById('uploadNovelForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const novelData = {
                title: document.getElementById('novelTitle').value,
                description: document.getElementById('novelDescription').value,
                category: document.getElementById('novelCategory').value,
                price: parseFloat(document.getElementById('novelPrice').value) || 0,
                featured: document.getElementById('featuredNovel').checked,
                status: 'approved'
            };
            
            const coverFile = document.getElementById('novelCover').files[0];
            const pdfFile = document.getElementById('novelPDF').files[0];
            
            if (!coverFile || !pdfFile) {
                alert('يرجى اختيار ملف الصورة وملف PDF');
                return;
            }
            
            // إظهار شريط التقدم
            document.getElementById('uploadProgress').style.display = 'block';
            
            try {
                // إضافة الرواية
                const novelResult = await dbManager.addNovel(novelData);
                if (!novelResult.success) throw new Error(novelResult.error);
                
                // رفع ملف PDF
                const pdfResult = await dbManager.uploadPDF(pdfFile, novelResult.id);
                if (!pdfResult.success) throw new Error(pdfResult.error);
                
                // رفع صورة الغلاف
                const coverResult = await this.uploadCoverImage(coverFile, novelResult.id);
                
                alert('تم رفع الرواية بنجاح!');
                document.getElementById('uploadNovelForm').reset();
                document.getElementById('uploadProgress').style.display = 'none';
                this.loadNovels();
                
            } catch (error) {
                alert('خطأ في رفع الرواية: ' + error.message);
                document.getElementById('uploadProgress').style.display = 'none';
            }
        });

        // حفظ الإعدادات
        document.getElementById('siteSettingsForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const settings = {
                siteTitle: document.getElementById('siteTitle').value,
                siteDescription: document.getElementById('siteDescription').value,
                whatsappNumber: document.getElementById('whatsappNumber').value,
                supportEmail: document.getElementById('supportEmail').value,
                siteStatus: document.getElementById('siteStatus').value
            };
            
            // حفظ الإعدادات في Firestore
            try {
                await firebase.db.collection('settings').doc('site').set(settings, { merge: true });
                alert('تم حفظ الإعدادات بنجاح!');
            } catch (error) {
                alert('خطأ في حفظ الإعدادات: ' + error.message);
            }
        });
    }

    // رفع صورة الغلاف
    async uploadCoverImage(file, novelId) {
        try {
            const storageRef = firebase.storage.ref();
            const imageRef = storageRef.child(`covers/${novelId}/${file.name}`);
            
            const uploadTask = imageRef.put(file);
            
            return new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    null,
                    (error) => reject(error),
                    async () => {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        await dbManager.updateNovel(novelId, { coverImage: downloadURL });
                        resolve({ success: true, url: downloadURL });
                    }
                );
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    // وظائف المساعدة
    getStatusText(status) {
        const statusMap = {
            'pending': 'قيد المراجعة',
            'approved': 'مقبول',
            'rejected': 'مرفوض'
        };
        return statusMap[status] || status;
    }

    // الوظائف الإدارية
    async editNovel(novelId) {
        alert('ميزة التعديل ستكون متاحة قريباً');
    }

    async approveNovel(novelId) {
        if (confirm('هل تريد قبول هذه الرواية؟')) {
            const result = await dbManager.updateNovel(novelId, { status: 'approved' });
            if (result.success) {
                alert('تم قبول الرواية');
                this.loadNovels();
            }
        }
    }

    async deleteNovel(novelId) {
        if (confirm('هل أنت متأكد من حذف هذه الرواية؟')) {
            const result = await dbManager.deleteNovel(novelId);
            if (result.success) {
                alert('تم حذف الرواية');
                this.loadNovels();
            }
        }
    }

    async updateUserRole(userId, newRole) {
        const result = await dbManager.updateUserRole(userId, newRole);
        if (result.success) {
            alert('تم تحديث دور المستخدم');
        }
    }

    async deleteCode(codeId) {
        if (confirm('هل تريد حذف هذا الكود؟')) {
            try {
                await firebase.db.collection('promoCodes').doc(codeId).delete();
                alert('تم حذف الكود');
                this.loadPromoCodes();
            } catch (error) {
                alert('خطأ في حذف الكود: ' + error.message);
            }
        }
    }

    viewUser(userId) {
        alert('ميزة عرض تفاصيل المستخدم ستكون متاحة قريباً');
    }
}

// وظائف عامة
function showAdminSection(sectionId) {
    // إخفاء جميع الأقسام
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // إظهار القسم المطلوب
    document.getElementById(sectionId).classList.add('active');
    
    // تحديث القائمة الجانبية
    document.querySelectorAll('.admin-menu a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
        }
    });
}

// Initialize admin manager when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.adminManager = new AdminManager();
});
