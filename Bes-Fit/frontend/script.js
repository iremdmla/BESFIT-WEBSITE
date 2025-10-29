// ====================================================================
// BES FİT - Fitness Takip Uygulaması: script.js
// ====================================================================

// Application State
let userData = {
    foods: [],
    exercises: [], // YENİ: Kullanıcının yaptığı egzersizleri tutar
    waterCount: 0,
    caloriesBurned: 0,
    dailyCalorieGoal: 2000,
    macroGoals: {
        protein: 150,
        carbs: 250,
        fat: 65
    },
    bodyValues: {
        weight: 70.0,
        height: 175.0
    }
};

// Food Database
let foodDatabase = [];
let selectedFoods = [];
let currentMealType = '';

// YENİ Egzersiz Değişkenleri
let exerciseDatabase = []; // Backend'den çekilen tüm egzersizler (exercises.json)
let selectedExercises = []; // Kullanıcının eklemek için seçtiği egzersizler


// Kalori Formülü: Kalori = MET x 3.5 x Kilo(kg) x Süre(dk) / 200
const CALORIE_FORMULA_MULTIPLIER = 3.5 / 200;

// ====================================================================
// YARDIMCI FONKSİYONLAR
// ====================================================================

// Page Navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// Load Food Database
async function loadFoodDatabase() {
    try {
        const response = await fetch('http://localhost:3000/api/foods'); 
        
        if (!response.ok) {
            throw new Error(`API'den yiyecek verisi yüklenemedi. Durum: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Sütun adları büyük/küçük harf duyarlı olabilir.
        foodDatabase = data.map(food => ({
            name: food.Yiyecekİsmi,
            category: food.Kategori, 
            gramsOrMl: parseFloat(food.ServisBoyutu_g_ml) || 0, // g/ml
            calories: parseFloat(food.Kalori_kcal) || 0, // Kalori (kcal)
            protein: parseFloat(food.Protein_g) || 0, // Protein (g)
            fat: parseFloat(food.Yağ_g) || 0,  // Yağ (g)
            carbs: parseFloat(food.Karbonhidrat_g) || 0  // Karbonhidrat (g)
        }));
        
        console.log(`Backend'den ${foodDatabase.length} yiyecek yüklendi.`);
    } catch (error) {
        console.error('API Yükleme Hatası (Yiyecek):', error);
    }
}

/// Load Exercise Database (API'den Çekim) - SQL tablosu ile eşleşen isimler
async function loadExerciseDatabase() {
    try {
        const response = await fetch('http://localhost:3000/api/exercises'); 
        
        if (!response.ok) {
            throw new Error(`API'den egzersiz verisi yüklenemedi. Durum: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Backend'de SQL sorgusuyla isimlendirilen alanları kullanıyoruz:
        // (ExerciseName as isim, MET_Value as met, Category as kategori)
        exerciseDatabase = data.map(ex => ({
            id: ex.id, 
            name: ex.isim,
            category: ex.kategori,
            met: parseFloat(ex.met) || 0, // MET Değeri
        }));
        
        console.log(`Backend'den ${exerciseDatabase.length} egzersiz yüklendi.`);
    } catch (error) {
        console.error('API Yükleme Hatası (Egzersiz):', error);
    }
}

// Save to LocalStorage
function saveUserData() {
    // Gerçek uygulamada buraya kullanıcı verilerini veritabanına kaydeden API çağrısı gelecek.
    // Şimdilik LocalStorage'da tutuyoruz.
    localStorage.setItem('besFitUserData', JSON.stringify(userData));
}

// Load from LocalStorage
function loadUserData() {
    const saved = localStorage.getItem('besFitUserData');
    if (saved) {
        const loadedData = JSON.parse(saved);
        // Yeni alanlar (exercises) yoksa boş array olarak başlat
        userData = { 
            ...userData, 
            ...loadedData, 
            exercises: loadedData.exercises || [],
            // userId varsa yükle
            userId: loadedData.userId || null
        };
    }
}

// ====================================================================
// UI GÜNCELLEME VE LİSTELEME
// ====================================================================

function updateWaterCounter() {
    document.getElementById('water-counter').textContent = `${userData.waterCount}/7`;
    
    // Update glasses based on water count
    const glassesArray = Array.from(document.querySelectorAll('.glass'));
    glassesArray.forEach((glass, index) => {
        if (index < userData.waterCount) {
            glass.classList.add('filled');
        } else {
            glass.classList.remove('filled');
        }
    });
}

function updateSelectedFoodsList() {
    const list = document.getElementById('selected-foods-list');
    list.innerHTML = selectedFoods.map((food, index) => `
        <li class="selected-food-item">
            <div class="selected-food-info">
                <div class="selected-food-name">${food.name} (${food.mealType === 'breakfast' ? 'Kahvaltı' : food.mealType === 'lunch' ? 'Öğle' : food.mealType === 'dinner' ? 'Akşam' : 'Atıştırmalık'})</div>
                <div class="selected-food-details">
                    ${food.calories} kcal | P:${food.protein}g | C:${food.carbs}g | Y:${food.fat}g
                </div>
            </div>
            <button class="remove-food-btn" onclick="removeSelectedFood(${index})">Sil</button>
        </li>
    `).join('');
}

// Seçilen egzersizler listesini güncelleme
function updateSelectedExercisesList() {
    const list = document.getElementById('selected-exercises-list');
    list.innerHTML = selectedExercises.map((ex, index) => `
        <li class="selected-food-item">
            <div class="selected-food-info">
                <div class="selected-food-name">${ex.name}</div>
                <div class="selected-food-details">
                    Süre: ${ex.duration} dk | MET: ${ex.met}
                </div>
            </div>
            <button class="remove-food-btn" onclick="removeSelectedExercise(${index})">Sil</button>
        </li>
    `).join('');
}
// ====================================================================
// ANA SAYFA GÜNCELLEMELERİ
// ====================================================================

function updateCalorieCircle() {
    const totalCaloriesTaken = userData.foods.reduce((sum, food) => sum + food.calories, 0);
    // Yakılan kaloriyi egzersiz listesinden hesaplayalım
    const totalCaloriesBurned = userData.exercises.reduce((sum, ex) => sum + ex.caloriesBurned, 0);
    
    // Yakılan kaloriyi userData'da güncelleyelim (Sadece gösterim için tutuluyordu, şimdi hesaplanacak)
    userData.caloriesBurned = totalCaloriesBurned;

    const netCalories = totalCaloriesTaken - totalCaloriesBurned;

    // Hedeften kalanı göster
    const remainingGoal = Math.max(0, userData.dailyCalorieGoal - netCalories);
    
    // Yüzdelik hesaplaması 
    const percentage = Math.min((totalCaloriesTaken / userData.dailyCalorieGoal) * 100, 100);
    
    document.getElementById('total-calories').textContent = Math.round(remainingGoal);
    document.getElementById('calories-taken').textContent = Math.round(totalCaloriesTaken);
    document.getElementById('calories-burned').textContent = totalCaloriesBurned; // Güncellendi
    
    const circumference = 2 * Math.PI * 65;
    const offset = circumference - (percentage / 100) * circumference;
    document.getElementById('calorie-circle').style.strokeDashoffset = offset;

    saveUserData(); // Değişiklikler kaydedildi
}

function updateMealCount() {
    const uniqueMeals = new Set(userData.foods.map(food => food.mealType));
    document.getElementById('meal-count').textContent = uniqueMeals.size;
    updateMealBubbles();
}

function updateMealBubbles() {
    const mealCounts = {
        breakfast: userData.foods.filter(f => f.mealType === 'breakfast').length,
        lunch: userData.foods.filter(f => f.mealType === 'lunch').length,
        dinner: userData.foods.filter(f => f.mealType === 'dinner').length,
        snack: userData.foods.filter(f => f.mealType === 'snack').length
    };
    
    const bubblesContainer = document.getElementById('meal-bubbles');
    bubblesContainer.innerHTML = '';
    
    Object.keys(mealCounts).forEach(mealType => {
        const count = mealCounts[mealType];
        if (count > 0) {
            const bubble = document.createElement('div');
            bubble.className = 'meal-bubble';
            bubble.textContent = mealType === 'breakfast' ? '1' : 
                                 mealType === 'lunch' ? '2' : 
                                 mealType === 'dinner' ? '3' : '4';
            bubblesContainer.appendChild(bubble);
        }
    });
}

function updateMacros() {
    const totalProtein = userData.foods.reduce((sum, food) => sum + food.protein, 0);
    const totalCarbs = userData.foods.reduce((sum, food) => sum + food.carbs, 0);
    const totalFat = userData.foods.reduce((sum, food) => sum + food.fat, 0);
    
    // Update amounts
    document.getElementById('protein-amount').textContent = `${Math.round(totalProtein)}g`;
    document.getElementById('carbs-amount').textContent = `${Math.round(totalCarbs)}g`;
    document.getElementById('fat-amount').textContent = `${Math.round(totalFat)}g`;
    
    // Update progress bars
    const proteinPercent = Math.min((totalProtein / userData.macroGoals.protein) * 100, 100);
    const carbsPercent = Math.min((totalCarbs / userData.macroGoals.carbs) * 100, 100);
    const fatPercent = Math.min((totalFat / userData.macroGoals.fat) * 100, 100);
    
    document.getElementById('protein-progress').style.width = `${proteinPercent}%`;
    document.getElementById('carbs-progress').style.width = `${carbsPercent}%`;
    document.getElementById('fat-progress').style.width = `${fatPercent}%`;

    saveUserData(); // Değişiklikler kaydedildi
}

function updateMealLists() {
    const mealTypes = {
        breakfast: document.getElementById('breakfast-list'),
        lunch: document.getElementById('lunch-list'),
        dinner: document.getElementById('dinner-list'),
        snack: document.getElementById('snack-list')
    };
    
    // Clear all lists
    Object.values(mealTypes).forEach(list => list.innerHTML = '');
    
    // Populate food lists
    userData.foods.forEach(food => {
        const list = mealTypes[food.mealType];
        if (list) {
            const item = document.createElement('li');
            item.textContent = food.name;
            list.appendChild(item);
        }
    });
    
    // Ana Sayfa Egzersiz Listesi (meals-card'ın altına eklenecek varsayım)
    const exerciseCard = document.querySelector('.card.exercise-card');
    if (exerciseCard) {
        let exerciseList = exerciseCard.querySelector('ul');
        if (!exerciseList) {
            exerciseList = document.createElement('ul');
            exerciseList.id = 'daily-exercise-summary';
            exerciseCard.appendChild(exerciseList);
        }
        // Egzersiz listesini güncelle
        exerciseList.innerHTML = userData.exercises.map(ex => `
            <li>${ex.name} - ${ex.duration} dk (${ex.caloriesBurned} kcal)</li>
        `).join('');
    }
}

// ====================================================================
// OLAY DİNLEYİCİLER (EVENTS)
// ====================================================================

// Login/Signup Navigation
document.getElementById('show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('signup-page');
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('login-page');
});

// Login Form
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const username = form.elements[0].value;
    const ePosta = form.elements[1].value; 
    const password = form.elements[2].value;
    
    if (!username || !ePosta || !password) {
        alert('Kullanıcı adı, E-posta ve şifre zorunludur.');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, ePosta, password }) 
        });
        
        const result = await response.json();

        if (response.ok) {
            alert(`Hoş geldiniz, ${result.firstName}!`);
            showPage('main-page'); 
        } else {
            alert(result.message || 'Giriş başarısız oldu. Bilgilerinizi kontrol edin.');
        }
    } catch (error) {
        console.error('Giriş API Hatası:', error);
        alert('Sunucuya bağlanılamadı.');
    }
});

// Signup Form
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const firstName = form.elements[0].value;
    const lastName = form.elements[1].value;
    const username = form.elements[2].value;
    const ePosta = form.elements[3].value;
    const password = form.elements[4].value;

    if (!firstName || !lastName || !username || !ePosta || !password) {
        alert('Lütfen tüm kayıt alanlarını doldurun.');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                firstName: firstName, 
                lastName: lastName, 
                username: username, 
                ePosta: ePosta, 
                password: password 
            }) 
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message || 'Kayıt başarılı! Lütfen giriş yapın.');
            form.reset(); 
            showPage('login-page'); 

        } else {
            alert(result.message || 'Kayıt başarısız oldu. Lütfen tekrar deneyin.'); 
        }
    } catch (error) {
        console.error('Kayıt API Hatası:', error);
        alert('Sunucuya bağlanılamadı. Backend\'in (node server.js) çalıştığından emin olun.');
    }
});

// Sidebar Navigation
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Show corresponding content
        const page = item.dataset.page;
        
        // TÜM İÇERİK DİV'LERİNİ SIFIRLA
        document.getElementById('home-content').classList.add('hidden');
        document.getElementById('daily-food-content').classList.add('hidden');
        document.getElementById('daily-exercise-content').classList.add('hidden');

        if (page === 'main') {
            document.getElementById('home-content').classList.remove('hidden');
        } else if (page === 'daily-food') {
            document.getElementById('daily-food-content').classList.remove('hidden');
        } else if (page === 'daily-exercise') { 
            document.getElementById('daily-exercise-content').classList.remove('hidden');
        }
    });
});

// Water Tracker
const glasses = document.querySelectorAll('.glass');
glasses.forEach((glass, index) => {
    glass.addEventListener('click', () => {
        if (glass.classList.contains('filled')) {
            glass.classList.remove('filled');
            userData.waterCount--;
        } else {
            glass.classList.add('filled');
            userData.waterCount++;
        }
        updateWaterCounter();
        saveUserData();
    });
});

// Body Values Control
function changeValue(type, delta) {
    userData.bodyValues[type] = parseFloat((userData.bodyValues[type] + delta).toFixed(1));
    document.getElementById(`${type}-value`).textContent = userData.bodyValues[type].toFixed(1);
    saveUserData(); // Değer değiştikçe kaydet
}

// ====================================================================
// YİYECEK TAKİP İŞLEMLERİ
// ====================================================================

// Yiyecek Arama
document.getElementById('food-search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const resultsDiv = document.getElementById('search-results');
    
    if (query.length === 0) {
        resultsDiv.style.display = 'none';
        return;
    }
    
    const results = foodDatabase.filter(food => 
        food.name.toLowerCase().includes(query)
    ).slice(0, 10);
    
    if (results.length > 0) {
        resultsDiv.innerHTML = results.map(food => `
            <div class="search-result-item" data-food-id="${food.name}">
                <strong>${food.name}</strong><br>
                <small>${food.calories} kcal | P:${food.protein}g | C:${food.carbs}g | Y:${food.fat}g</small>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.innerHTML = '<div class="search-result-item">Sonuç bulunamadı</div>';
        resultsDiv.style.display = 'block';
    }
});

// Yiyecek Arama Sonucu Tıklama
document.getElementById('search-results').addEventListener('click', (e) => {
    if (e.target.closest('.search-result-item')) {
        const item = e.target.closest('.search-result-item');
        const foodName = item.dataset.foodId;
        const food = foodDatabase.find(f => f.name === foodName);
        
        if (food) {
            if (!currentMealType) {
                alert('Lütfen önce öğün tipi seçin!');
                return;
            }
            addSelectedFood(food, currentMealType);
            document.getElementById('food-search').value = '';
            document.getElementById('search-results').style.display = 'none';
        }
    }
});

// Öğün Tipi Seçimi
document.getElementById('meal-type').addEventListener('change', (e) => {
    currentMealType = e.target.value;
});

// Seçilen Yiyeceği Ekleme
function addSelectedFood(food, mealType) {
    selectedFoods.push({
        ...food,
        mealType: mealType
    });
    updateSelectedFoodsList();
}

// Seçilen Yiyeceği Kaldırma
function removeSelectedFood(index) {
    selectedFoods.splice(index, 1);
    updateSelectedFoodsList();
}

// Bitti Butonu (Yiyecekleri Kaydet)
document.getElementById('finish-btn').addEventListener('click', () => {
    if (selectedFoods.length === 0) {
        alert('Lütfen en az bir yiyecek seçin!');
        return;
    }
    
    // Yiyecekleri ana listeye ekle
    selectedFoods.forEach(food => {
        userData.foods.push({
            id: Date.now() + Math.random(),
            mealType: food.mealType,
            name: food.name,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat
        });
    });
    
    // Clear selections
    selectedFoods = [];
    updateSelectedFoodsList();
    document.getElementById('meal-type').value = '';
    
    // Update displays
    updateCalorieCircle();
    updateMealCount();
    updateMacros();
    updateMealLists();
    
    // Switch to home page
    document.querySelector('.nav-item[data-page="main"]').click();
    
    alert('Yiyecekler başarıyla eklendi!');
    saveUserData();
});

// ====================================================================
// YENİ: EGZERSİZ TAKİP İŞLEMLERİ
// ====================================================================

// Egzersiz Arama
document.getElementById('exercise-search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const resultsDiv = document.getElementById('exercise-search-results');
    
    if (query.length === 0) {
        resultsDiv.style.display = 'none';
        return;
    }
    
    const results = exerciseDatabase.filter(ex => 
        ex.name.toLowerCase().includes(query)
    ).slice(0, 10);
    
    if (results.length > 0) {
        resultsDiv.innerHTML = results.map(ex => `
            <div class="search-result-item" data-exercise-name="${ex.name}">
                <strong>${ex.name}</strong><br>
                <small>${ex.category} | MET Değeri: ${ex.met}</small>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.innerHTML = '<div class="search-result-item">Sonuç bulunamadı</div>';
        resultsDiv.style.display = 'block';
    }
});

// Egzersiz Arama Sonucu Tıklama
document.getElementById('exercise-search-results').addEventListener('click', (e) => {
    if (e.target.closest('.search-result-item')) {
        const item = e.target.closest('.search-result-item');
        const exerciseName = item.dataset.exerciseName;
        const exercise = exerciseDatabase.find(ex => ex.name === exerciseName);
        
        if (exercise) {
            // Kullanıcıdan süre girmesini isteyelim (varsayılan 30 dk)
            const durationInput = document.getElementById('exercise-duration');
            const duration = parseFloat(durationInput.value) || 30; 
            
            if (duration <= 0) {
                alert('Süre 0\'dan büyük olmalıdır.');
                return;
            }
            
            addSelectedExercise(exercise, duration);
            document.getElementById('exercise-search').value = '';
            document.getElementById('exercise-search-results').style.display = 'none';
        }
    }
});

// Seçilen Egzersizi Ekleme
function addSelectedExercise(exercise, duration) {
    // Aynı egzersiz tekrar eklenebilir.
    selectedExercises.push({
        ...exercise,
        duration: duration 
    });
    updateSelectedExercisesList();
}

// Seçilen Egzersizi Kaldırma
function removeSelectedExercise(index) {
    selectedExercises.splice(index, 1);
    updateSelectedExercisesList();
}

// Egzersizleri Ekle Butonu
document.getElementById('add-exercise-btn').addEventListener('click', () => {
    if (selectedExercises.length === 0) {
        alert('Lütfen en az bir egzersiz seçin!');
        return;
    }
    
    // Kilo değeri yoksa uyarı ver
    const userWeight = userData.bodyValues.weight;
    if (userWeight <= 0) {
        alert('Lütfen profilinizdeki kilonuzu (kg) doğru girdiğinizden emin olun.');
        return;
    }

    let totalCaloriesBurned = 0;
    
    selectedExercises.forEach(ex => {
        // Kalori Hesaplaması: Kalori = MET x 3.5 x Kilo(kg) x Süre(dk) / 200
        const caloriesBurned = Math.round(ex.met * userWeight * ex.duration * CALORIE_FORMULA_MULTIPLIER);
        
        // Egzersizi kullanıcı verilerine ekle
        userData.exercises.push({
            id: Date.now() + Math.random(),
            name: ex.name,
            duration: ex.duration,
            met: ex.met,
            caloriesBurned: caloriesBurned
        });
        
        totalCaloriesBurned += caloriesBurned;
    });

    // Seçimleri temizle
    selectedExercises = [];
    updateSelectedExercisesList();
    
    // Display'leri güncelle
    updateCalorieCircle(); // Toplam yakılan kalori ve hedef güncellendi
    updateMealLists(); // Ana sayfadaki egzersiz listesini günceller

    // Ana sayfaya geçiş yap
    document.querySelector('.nav-item[data-page="main"]').click();
    
    alert(`${totalCaloriesBurned} kcal yakıldı. Egzersizler başarıyla eklendi!`);
    saveUserData();
});


// ====================================================================
// BAŞLATMA (INITIALIZATION)
// ====================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Load saved user data
    loadUserData();
    
    // Load food and exercise databases PARALEL OLARAK YÜKLEYİN
    await Promise.all([
        loadFoodDatabase(),
        loadExerciseDatabase() // YENİ EKLENDİ
    ]);
    
    // Update UI
    updateCalorieCircle();
    updateMealCount();
    updateMacros();
    updateMealLists();
    updateWaterCounter();
    
    // Update body values if loaded
    document.getElementById('weight-value').textContent = userData.bodyValues.weight.toFixed(1);
    document.getElementById('height-value').textContent = userData.bodyValues.height.toFixed(1);
    
    // Uygulama her zaman login/signup sayfasından başlasın
    // showPage('login-page'); // Eğer login sayfanız varsa bu aktif olmalı
});