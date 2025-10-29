// backend/server.js

const express = require('express');
const cors = require('cors');
const sql = require('mssql'); // SQL Server sürücüsü
const bcrypt = require('bcrypt'); // Şifre HASH'lemek için eklendi!
const fs = require('fs'); // Dosya sistemi işlemleri için eklendi
const path = require('path'); // Dizin yollarını yönetmek için eklendi

const app = express();
const port = 3000; // Backend 3000 portunda çalışacak
const saltRounds = 10; // bcrypt güvenlik seviyesi

// Middleware (Ara Yazılımlar)
app.use(cors()); // Frontend'den gelen istekleri kabul et
app.use(express.json()); // JSON formatındaki verileri okuyabilmek için

// ----------------------------------------------------
// SQL SERVER BAĞLANTI AYARLARI (KENDİ AYARLARINIZLA DEĞİŞTİRİN!)
// ----------------------------------------------------
const dbConfig = {
    user: 'sa', 
    password: '1',
    server: 'DAMLA', // Veya SQL Server adresiniz
    database: 'BESFIT_DB',
    port: 1433,
    options: {
        trustServerCertificate: true // Localhost veya kendi sunucunuz için gerekli olabilir
    }
};

// Veritabanı bağlantısını kurma
async function connectDB() {
    try {
        await sql.connect(dbConfig);
        console.log('SQL Server bağlantısı başarılı!');
    } catch (err) {
        console.error('SQL Server bağlantı hatası:', err);
    }
}
connectDB();


// API UÇ NOKTALARI (ROUTES) BURAYA GELECEK

// Yiyecek veritabanını frontend'e gönderen API
app.get('/api/foods', async (req, res) => {
    try {
        // Burada SQL sorgunuzun tam olarak bu sütunları seçtiğinden emin olun.
        const query = `SELECT Yiyecekİsmi, Kategori, ServisBoyutu_g_ml, Kalori_kcal, Protein_g, Yağ_g, Karbonhidrat_g FROM Foods`; 
        const result = await sql.query(query); 
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Yiyecek verisi çekilirken hata:', err);
        res.status(500).send('Veritabanı hatası');
    }
});


// 2. 🤸 EGZERSİZ VERİLERİNİ SQL'DEN ÇEKEN API
app.get('/api/exercises', async (req, res) => {
    try {
        // Frontend'de beklenen alan adlarına dönüştürmek için ALIAS (AS) kullanıyoruz.
        // Frontend: id, isim, kategori, met
        // SQL Tablosu: ExerciseID, ExerciseName, Category, MET_Value
        const query = `
            SELECT 
                ExerciseID as id, 
                ExerciseName as isim, 
                Category as kategori, 
                MET_Value as met 
            FROM Exercises
        `; 
        
        const result = await sql.query(query);
        
        res.json(result.recordset);
        
    } catch (err) {
        console.error('Egzersiz verisi SQL\'den çekilirken hata:', err);
        res.status(500).send({ message: 'Egzersiz veritabanı hatası.' });
    }
});


// KAYIT (Signup) API'ı - YENİ TABLOYA UYGUN VE GÜVENLİ
app.post('/api/auth/signup', async (req, res) => {
    // Frontend'den gelen 5 alanı da yakalıyoruz
    const { firstName, lastName, username, ePosta, password } = req.body; 
    
    // Tüm zorunlu alanları kontrol et
    if (!firstName || !lastName || !username || !ePosta || !password) {
        return res.status(400).send({ message: 'Lütfen tüm kayıt alanlarını doldurun.' });
    }

    try {
        // 1. Şifreyi güvenli bir şekilde HASH'le
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        const request = new sql.Request();
        
        // 2. Verileri SQL'e güvenli bir şekilde göndermek için input kullanıyoruz.
        request.input('firstName', sql.NVarChar, firstName);
        request.input('lastName', sql.NVarChar, lastName);
        request.input('username', sql.NVarChar, username);
        request.input('ePosta', sql.NVarChar, ePosta);
        request.input('passwordHash', sql.NVarChar, passwordHash); // HASH'lenmiş şifre
        
        // 3. Kullanıcıyı veritabanına ekle
        // Tablodaki sütun isimleriyle uyumlu sorgu:
        await request.query(`
            INSERT INTO Users (FirstName, LastName, Username, E_posta, Password) 
            VALUES (@firstName, @lastName, @username, @ePosta, @passwordHash)
        `);
        
        res.status(201).send({ message: 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.' });
        
    } catch (err) {
        console.error('Kayıt API Hatası:', err);
        
        // Kullanıcı adı zaten mevcutsa 2627 (Unique Constraint Violation) hatası döner
        if (err.number === 2627) {
            // Hata mesajı, hangi alanın çakıştığına bağlı olarak özelleştirilebilir.
            return res.status(409).send({ message: 'Bu kullanıcı adı veya E-posta zaten kullanılıyor.' });
        }
        
        res.status(500).send({ message: 'Kayıt işlemi başarısız. Lütfen tekrar deneyin.' });
    }
});


// GİRİŞ (Login) API'ı - GÜVENLİ ŞİFRE KONTROLÜ İLE GÜNCELLENDİ
app.post('/api/auth/login', async (req, res) => {
    // Frontend'den gelen 3 verinin tamamını yakala
    const { username, ePosta, password } = req.body; 
    
    if (!username || !ePosta || !password) { // 3 alanın da boş olup olmadığını kontrol et
        return res.status(400).send({ message: 'Kullanıcı adı, E-posta ve şifre zorunludur.' });
    }

    try {
        // 1. Kullanıcıyı veritabanında hem Username hem de E_posta alanında ara
        const request = new sql.Request();
        request.input('username', sql.NVarChar, username); 
        request.input('ePosta', sql.NVarChar, ePosta); // E-posta'yı da sorguya dahil ediyoruz
        
        // SQL Sorgusunu GÜNCELLİYORUZ: Hem Username, hem de E_posta EŞLEŞMELİ
        const result = await request.query(`
            SELECT UserId, Username, Password, FirstName 
            FROM Users 
            WHERE Username = @username AND E_posta = @ePosta
        `); 
        
        const user = result.recordset[0];
        
        if (!user) {
             // Kullanıcı adı ve/veya E-posta bulunamadı/eşleşmedi
             return res.status(401).send({ message: 'Kullanıcı adı/E-posta kombinasyonu hatalı.' });
        }
        
        // 2. Şifreleri Karşılaştır (bcrypt.compare)
        const isMatch = await bcrypt.compare(password, user.Password);

        if (isMatch) { 
            // 3. Başarılı giriş
            res.json({ 
                userId: user.UserId, 
                username: user.Username,
                firstName: user.FirstName,
            }); 
        } else {
            // Şifre eşleşmedi
            res.status(401).send({ message: 'Kullanıcı adı/E-posta veya şifre hatalı.' });
        }
    } catch (err) {
        console.error('Giriş hatası:', err);
        res.status(500).send({ message: 'Sunucu hatası.' });
    }
});


// Sunucuyu Başlatma (AYNI KALIYOR)
app.listen(port, () => {
    console.log(`Backend sunucusu http://localhost:${port} adresinde çalışıyor...`);
});