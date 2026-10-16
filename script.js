document.addEventListener("DOMContentLoaded", () => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const KEY = {
    admins:"bc_admins", residents:"bc_residents", appointments:"bc_appointments",
    requests:"bc_requests", records:"bc_records", messages:"barangay_messages",
    admin:"bc_current_admin", resident:"bc_current_resident"
  };

  const read = (key, fallback=[]) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const getAdmin = () => localStorage.getItem(KEY.admin);
  const getResident = () => read(KEY.resident, null);
  const setAdmin = u => u ? localStorage.setItem(KEY.admin,u) : localStorage.removeItem(KEY.admin);
  const setResident = r => r ? write(KEY.resident,r) : localStorage.removeItem(KEY.resident);
  const appointments = () => read(KEY.appointments, []);
  const requests = () => read(KEY.requests, []);
  const records = () => read(KEY.records, []);
  const residents = () => read(KEY.residents, []);
  const messages = () => {
    const legacyKey = "bc_messages";
    const persisted = read(KEY.messages, read(legacyKey, []));
    if (!localStorage.getItem(KEY.messages) && localStorage.getItem(legacyKey)) {
      write(KEY.messages, persisted);
    }
    return persisted;
  };

  const toast = (msg) => {
    const t=$("#toast"); if(!t)return;
    t.textContent=msg; t.classList.add("show"); clearTimeout(window.__toast);
    window.__toast=setTimeout(()=>t.classList.remove("show"),2500);
  };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const showModal = id => {
    const m=$("#"+id);
    if(!m)return;
    m.style.zIndex=String(200 + $$(".modal[aria-hidden='false']").length);
    m.setAttribute("aria-hidden","false");
    document.body.style.overflow="hidden";
  };
  const hideModal = id => {
    const m=$("#"+id);
    if(m){m.setAttribute("aria-hidden","true");m.style.zIndex="";}
    if(!$$(".modal[aria-hidden='false']").length)document.body.style.overflow="";
  };
  const REQUEST_STATUS_ORDER = ["Pending","Processing","Approved","Ready for Pickup","Completed","Rejected","Cancelled"];
  const REQUEST_STATUS_META = {
    Pending: { label: "Pending", className: "pending", progress: 18 },
    Processing: { label: "Processing", className: "processing", progress: 38 },
    Approved: { label: "Approved", className: "approved", progress: 60 },
    "Ready for Pickup": { label: "Ready for Pickup", className: "ready-pickup", progress: 80 },
    Completed: { label: "Completed", className: "completed", progress: 100 },
    Rejected: { label: "Rejected", className: "rejected", progress: 100 },
    Cancelled: { label: "Cancelled", className: "cancelled", progress: 100 }
  };

  function normalizeRequestStatus(status){
    const value = String(status || "Pending").trim();
    return REQUEST_STATUS_META[value] ? value : "Pending";
  }

  function getRequestHistory(request){
    const history = Array.isArray(request?.statusHistory) ? request.statusHistory : [];
    const current = normalizeRequestStatus(request?.status || "Pending");
    if (history.length && history[history.length - 1]?.status !== current) {
      history.push({ status: current, at: request?.updatedAt || request?.created || new Date().toISOString() });
    }
    if (!history.length) {
      history.push({ status: current, at: request?.created || new Date().toISOString() });
    }
    return history;
  }

  function getRequestStatusMeta(status){
    const normalized = normalizeRequestStatus(status);
    return REQUEST_STATUS_META[normalized] || REQUEST_STATUS_META.Pending;
  }

  function getRequestProgress(status){
    return getRequestStatusMeta(status).progress;
  }

  async function hash(str){
    if(window.crypto?.subtle){
      const data=new TextEncoder().encode(str), buf=await crypto.subtle.digest("SHA-256",data);
      return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");
    }
    return btoa(unescape(encodeURIComponent(str)));
  }

  // ==========================================
  // PRIVATE ADMIN ACCOUNT
  // ==========================================
    const PRIVATE_ADMIN_USERNAME = "admin";
    const PRIVATE_ADMIN_PASSWORD = "admin@123";

  async function createPrivateAdmin(){
    const admins = read(KEY.admins, []);
    const passwordHash = await hash(PRIVATE_ADMIN_PASSWORD + PRIVATE_ADMIN_USERNAME);
    const existingIndex = admins.findIndex(a => a.username === PRIVATE_ADMIN_USERNAME);

    if(existingIndex >= 0){
      // Keep the private account password synchronized.
      admins[existingIndex].hash = passwordHash;
    }else{
      admins.push({
        username: PRIVATE_ADMIN_USERNAME,
        hash: passwordHash,
        created: new Date().toISOString()
      });
    }

    // Remove the old demo "admin/admin123" account.
    const oldHash = await hash("admin123admin");
    const cleanedAdmins = admins.filter(a => !(a.username === "admin" && a.hash === oldHash));
    write(KEY.admins, cleanedAdmins);
  }

  async function setup(){
    await createPrivateAdmin();

    if(!localStorage.getItem(KEY.records)){
      write(KEY.records,[
        {id:"BR-1001",name:"Juan Dela Cruz",age:32,address:"Purok 1, Barangay San Isidro"},
        {id:"BR-1002",name:"Maria Santos",age:28,address:"Purok 3, Barangay San Isidro"},
        {id:"BR-1003",name:"Pedro Garcia",age:45,address:"Purok 2, Barangay San Isidro"}
      ]);
    }
  }


  // Navigation
  const navLinks=$$(".nav-link");
  navLinks.forEach(a=>a.addEventListener("click",e=>{
    const id=a.getAttribute("href")?.slice(1);
    if(id==="records" && !getAdmin()){e.preventDefault(); showModal("adminModal"); toast("Admin login is required for Records."); return;}
    if(id){e.preventDefault(); document.getElementById(id)?.scrollIntoView({behavior:"smooth"});}
    $("#mainNav")?.classList.remove("open"); $("#hamburger")?.setAttribute("aria-expanded","false");
  }));
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(en=>{if(en.isIntersecting){navLinks.forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+en.target.id));}});
  },{rootMargin:"-35% 0px -55% 0px"});
  ["home","about","features","services","dashboard","records","contact"].forEach(id=>{const el=$("#"+id);if(el)observer.observe(el);});
  $("#hamburger")?.addEventListener("click",()=>{const n=$("#mainNav"),h=$("#hamburger");const open=n.classList.toggle("open");h.setAttribute("aria-expanded",String(open));});

  // Tabs
  $$(".tabs").forEach(tabs=>{
    $$(".tab-btn",tabs).forEach(btn=>btn.addEventListener("click",()=>{
      const target=btn.dataset.tab;
      $$(".tab-btn",tabs).forEach(b=>b.classList.toggle("active",b===btn));
      $$(".tab-panel",tabs).forEach(p=>p.classList.toggle("active",p.id===target));
    }));
  });

  // Generic actions
  document.addEventListener("click",e=>{
    const action=e.target.closest("[data-action]")?.dataset.action;
    if(!action)return;
    if(action==="book"){
      if(!getResident()){showModal("residentModal");toast("Please sign in as a resident before booking.");}
      else {prefillAppointment();showModal("appointmentModal");}
    }
    if(action==="request"){
      document.querySelector("#services")?.scrollIntoView({behavior:"smooth"});
      const btn=$(".service-tabs .tab-btn:nth-child(2)"); btn?.click();
    }
  });
  $$(".feature-card").forEach(card=>card.addEventListener("click",()=>{
    const f=card.dataset.feature;
    if(f==="appointment") document.querySelector("[data-action='book']")?.click();
    else if(f==="records"){if(!getAdmin())showModal("adminModal");else $("#records")?.scrollIntoView({behavior:"smooth"});}
    else if(f==="requests") document.querySelector(".service-tabs .tab-btn:nth-child(2)")?.click(), $("#services")?.scrollIntoView({behavior:"smooth"});
    else $("#dashboard")?.scrollIntoView({behavior:"smooth"});
  }));

  // Modal close
  document.addEventListener("click",e=>{const id=e.target.closest("[data-close]")?.dataset.close;if(id)hideModal(id);});
  $$(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)hideModal(m.id);}));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".modal[aria-hidden='false']").forEach(m=>hideModal(m.id));});

  // Auth UI
  function updateUI(){
    const admin=getAdmin(), resident=getResident();
    $$(".admin-link,.admin-only").forEach(el=>el.style.display=admin ? (el.classList.contains("admin-only")?"block":""):"none");
    $("#logoutBtn")?.classList.toggle("hidden",!admin);
    $("#residentLogoutBtn")?.classList.toggle("hidden",!resident);
    $("#profileBtn")?.classList.toggle("hidden",!resident);
    $("#adminBtn")?.classList.toggle("hidden",!!admin);
    $("#residentBtn")?.classList.toggle("hidden",!!resident);
    $("#sessionBadge").textContent=admin?`Admin: ${admin}`:resident?`Resident: ${resident.username}`:"";
    renderDashboard();
    renderRecords();
    updateHeroStats();
  }

  $("#adminBtn")?.addEventListener("click",()=>{
    $("#adminUser").value="";
    $("#adminPass").value="";
    $("#adminMessage").textContent="";
    showModal("adminModal");
  });
  $("#closeAdmin")?.addEventListener("click",()=>hideModal("adminModal"));
  $("#cancelAdmin")?.addEventListener("click",()=>hideModal("adminModal"));
  $("#residentBtn")?.addEventListener("click",()=>showModal("residentModal"));
  $("#guestAdminBtn")?.addEventListener("click",()=>showModal("adminModal"));
  $("#guestResidentBtn")?.addEventListener("click",()=>showModal("residentModal"));
  $("#logoutBtn")?.addEventListener("click",()=>{setAdmin(null);toast("Admin signed out.");updateUI();});
  $("#residentLogoutBtn")?.addEventListener("click",()=>{setResident(null);toast("Resident signed out.");updateUI();});

  $("#adminLoginForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const username = $("#adminUser").value.trim();
  const password = $("#adminPass").value;

  if (!username || !password) {
    $("#adminMessage").textContent =
      "Please enter your username and password.";
    return;
  }

  const hashed = await hash(password + username);

  const found = read(KEY.admins, []).find(
    admin =>
      admin.username === username &&
      admin.hash === hashed
  );

  if (!found) {
    $("#adminMessage").textContent =
      "Invalid username or password.";

    $("#adminPass").value = "";
    return;
  }

  // Login successful
  setAdmin(username);

  // Clear credentials from the form
  $("#adminUser").value = "";
  $("#adminPass").value = "";

  $("#adminMessage").textContent =
    "Signed in successfully.";

  hideModal("adminModal");

  toast("Welcome, Admin!");

  updateUI();
});

  $("#residentSignupForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const u=$("#ruser").value.trim(),email=$("#remail").value.trim(),barangay=$("#rbarangay").value.trim(),purok=$("#rpurok").value.trim(),age=Number($("#rage").value),p1=$("#rpass").value,p2=$("#rpass2").value;
    const msg=$("#residentSignupMessage");
    if(p1.length<6){msg.textContent="Password must be at least 6 characters.";return;}
    if(p1!==p2){msg.textContent="Passwords do not match.";return;}
    const arr=residents();
    if(arr.some(r=>r.username.toLowerCase()===u.toLowerCase())){msg.textContent="Username already exists.";return;}
    const obj={username:u,email,barangay,purok,age,hash:await hash(p1+u),fullname:u,created:new Date().toISOString()};
    arr.push(obj);write(KEY.residents,arr);syncResidentRecord(obj);e.target.reset();msg.textContent="Account created. You can now sign in.";toast("Resident account created.");
  });

  $("#residentLoginForm")?.addEventListener("submit",async e=>{
    e.preventDefault();const u=$("#resUser").value.trim(),p=$("#resPass").value;
    const hashed=await hash(p+u);
    const found=residents().find(r=>r.username===u && r.hash===hashed);
    if(!found){$("#residentMessage").textContent="Invalid credentials.";return;}
    setResident(found);setAdmin(null);syncResidentRecord(found);$("#residentMessage").textContent="Signed in successfully.";hideModal("residentModal");toast(`Welcome, ${found.username}!`);updateUI();
  });

  // Profile
  $("#profileBtn")?.addEventListener("click",()=>{
    const r=getResident();if(!r)return;
    $("#profileName").textContent=r.fullname||r.username;$("#profileEmail").textContent=r.email||"";
    $("#profileBarangay").textContent=r.barangay||"—";$("#profilePurok").textContent=r.purok||"—";$("#profileUsername").textContent=r.username;
    const av=$("#profileAvatar");av.innerHTML=r.profilePic?`<img src="${r.profilePic}" alt="Profile picture">`:"👤";showModal("profileModal");
  });
  $("#profilePicInput")?.addEventListener("change",e=>{
    const file=e.target.files?.[0],r=getResident();if(!file||!r)return;
    const reader=new FileReader();reader.onload=()=>{r.profilePic=reader.result;setResident(r);$("#profileAvatar").innerHTML=`<img src="${r.profilePic}" alt="Profile picture">`;toast("Profile picture updated.");};reader.readAsDataURL(file);
  });

  // Keep resident accounts synchronized with Admin > Resident Records.
  // This makes every registered/booked resident appear in the admin records.
  function syncResidentRecord(r){
    if(!r)return;
    const arr=records();
    const idx=arr.findIndex(x=>
      (x.residentUser && r.username && x.residentUser===r.username) ||
      (x.name && r.fullname && x.name.toLowerCase()===r.fullname.toLowerCase())
    );
    const obj={
      id: idx>=0 ? arr[idx].id : `BR-${Date.now().toString().slice(-5)}`,
      residentUser:r.username,
      name:r.fullname||r.username,
      age:r.age ? Number(r.age) : "",
      address:[r.purok,r.barangay].filter(Boolean).join(", ")
    };
    if(idx>=0) arr[idx]={...arr[idx],...obj};
    else arr.push(obj);
    write(KEY.records,arr);
    return obj;
  }

  // Appointment booking
  function prefillAppointment(){
    const r=getResident(); if(!r)return;
    $("#appointmentEmail").value=r.email||"";
    const today=new Date();today.setMinutes(today.getMinutes()-today.getTimezoneOffset());$("#appointmentDate").min=today.toISOString().slice(0,10);
    $("#appointmentDate").value="";$("#appointmentTime").innerHTML='<option value="">Choose a date first</option>';
    $("#appointmentMessage").textContent="";
  }
  function refreshTimes(){
    const date=$("#appointmentDate").value,sel=$("#appointmentTime");if(!date)return;
    sel.innerHTML='<option value="">Choose a time</option>';
    for(let h=8;h<17;h++){
      const time=`${String(h).padStart(2,"0")}:00`,count=appointments().filter(a=>a.date===date&&a.time===time).length;
      const opt=document.createElement("option");opt.value=time;opt.textContent=`${formatTime(time)}${count>=2?" — Full":""}`;opt.disabled=count>=2;sel.appendChild(opt);
    }
  }
  function formatTime(t){const [h,m]=t.split(":").map(Number);const ap=h>=12?"PM":"AM";const hh=h%12||12;return `${hh}:${String(m).padStart(2,"0")} ${ap}`;}
  $("#appointmentDate")?.addEventListener("change",refreshTimes);
  $("#appointmentForm")?.addEventListener("submit",e=>{
    e.preventDefault();const r=getResident();if(!r){hideModal("appointmentModal");showModal("residentModal");return;}
    const date=$("#appointmentDate").value,time=$("#appointmentTime").value;
    if(!date||!time){$("#appointmentMessage").textContent="Please select a date and time.";return;}
    if(appointments().filter(a=>a.date===date&&a.time===time).length>=2){$("#appointmentMessage").textContent="That time slot is full.";refreshTimes();return;}
    const residentRecord=syncResidentRecord(r); const arr=appointments();const created=new Date().toISOString();const item={id:makeId("APT"),residentUser:r.username,recordId:residentRecord?.id||"",name:r.fullname||r.username,email:r.email,barangay:r.barangay,purok:r.purok,serviceType:$("#serviceType").value,date,time,notes:$("#appointmentNotes").value.trim(),status:"Pending",statusHistory:[{status:"Pending",at:created}],created};
    arr.push(item);write(KEY.appointments,arr);e.target.reset();$("#appointmentMessage").textContent="Appointment confirmed.";toast(`Appointment ${item.id} booked.`);setTimeout(()=>hideModal("appointmentModal"),600);updateUI();
  });

  // Requests
  $("#requestForm")?.addEventListener("submit",e=>{
    e.preventDefault();const r=getResident();
    if(!r){showModal("residentModal");toast("Please sign in as a resident to submit a request.");return;}
    const now = new Date().toISOString();
    const arr=requests(), item={
      id:makeId("REQ"),residentUser:r.username,name:r.fullname||r.username,type:$("#requestType").value,
      subject:$("#requestSubject").value.trim(),details:$("#requestDetails").value.trim(),email:$("#requestContact").value.trim(),
      priority:$("#requestPriority").value || "Normal",status:"Pending",statusHistory:[{status:"Pending",at:now}],created:now,updatedAt:now
    };
    arr.push(item);write(KEY.requests,arr);e.target.reset();$("#requestMessage").textContent=`Request submitted. Your ID is ${item.id}.`;toast("Service request submitted.");updateUI();
  });
  function addRequestStatus(item, status){
    const request = item || {};
    const statusHistory = Array.isArray(request.statusHistory) ? request.statusHistory : [];
    const entry = { status: normalizeRequestStatus(status), at: new Date().toISOString() };
    request.statusHistory = [...statusHistory, entry];
    request.status = entry.status;
    request.updatedAt = entry.at;
    return request;
  }
  function makeId(prefix){const n=Math.floor(1000+Math.random()*9000);return `${prefix}-${n}`;}
  $("#searchRequestBtn")?.addEventListener("click",()=>{
    const id=$("#requestSearch").value.trim().toUpperCase(),result=requests().find(r=>r.id===id),box=$("#requestStatusResult");
    if(!result){box.textContent="No request found. Check the Request ID and try again.";return;}
    const statusMeta = getRequestStatusMeta(result.status);
    box.innerHTML=`<div class="list-item"><span class="status-dot ${statusMeta.className}"></span><div class="grow"><strong>${escapeHTML(result.subject || result.type)}</strong><small>${escapeHTML(result.type)} • ${new Date(result.created).toLocaleDateString()}</small></div><span class="pill ${statusMeta.className}">${escapeHTML(statusMeta.label)}</span></div><p><b>Request ID:</b> ${escapeHTML(result.id)}</p><p>${escapeHTML(result.details || result.subject)}</p>`;
  });
  $("#requestSearch")?.addEventListener("keydown",e=>{
    if(e.key==="Enter"){$("#searchRequestBtn")?.click();}
  });

  function renderRequestCard(item){
    const statusMeta = getRequestStatusMeta(item.status);
    const createdAt = new Date(item.created || Date.now());
    const residentName = item.name || item.residentUser || "Resident";
    const residentInitial = (residentName.trim().charAt(0) || "R").toUpperCase();
    const priorityClass = String(item.priority || "Normal").toLowerCase();
    const progressValue = getRequestProgress(item.status);

    return `
      <div class="request-card request-card--${statusMeta.className}">
        <div class="request-card-top">
          <div class="request-card-icon">📝</div>
          <div class="request-avatar">${escapeHTML(residentInitial)}</div>
          <div class="request-summary">
            <div class="request-heading-row">
              <span class="request-id">${escapeHTML(item.id)}</span>
              <span class="priority-badge priority-${priorityClass}">${escapeHTML(item.priority || "Normal")}</span>
            </div>
            <h4>${escapeHTML(item.subject || item.type || "Service Request")}</h4>
            <div class="request-meta-row">
              <span>${escapeHTML(item.type || "Service")}</span>
              <span>•</span>
              <span>${escapeHTML(createdAt.toLocaleString([], { dateStyle: "short", timeStyle: "short" }))}</span>
            </div>
            <div class="request-status-wrap">
              <span class="status-badge status-${statusMeta.className}">${escapeHTML(statusMeta.label)}</span>
            </div>
          </div>
        </div>
        <div class="request-progress-block">
          <div class="request-progress-track"><span style="width: ${progressValue}%"></span></div>
          <small>${progressValue}% complete</small>
        </div>
        <div class="request-card-actions">
          <button class="btn btn-outline btn-small" data-request-detail="${escapeHTML(item.id)}">View Details</button>
        </div>
      </div>
    `;
  }

  function renderRecentRequests(){
    const list = requests().slice().sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0)).slice(0, 5);
    const container = $("#adminRequestsList");
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<div class="empty-state"><strong>No recent requests</strong><p>New service requests will appear here as soon as residents submit them.</p></div>';
      return;
    }

    container.innerHTML = list.map(renderRequestCard).join("");
  }

  function renderRequestsOverview(filter = "All"){
    const container = $("#requestsOverviewList");
    const filters = $("#requestsOverviewFilters");
    if (!container || !filters) return;

    const selected = filter && REQUEST_STATUS_ORDER.includes(filter) ? filter : "All";
    const items = requests().slice().sort((a,b)=> new Date(b.created || 0) - new Date(a.created || 0));
    const filtered = selected === "All" ? items : items.filter(item => normalizeRequestStatus(item.status) === selected);

    filters.innerHTML = ["All", ...REQUEST_STATUS_ORDER].map(status => `
      <button class="request-filter ${selected === status ? "active" : ""}" data-request-filter="${escapeHTML(status)}">${escapeHTML(status)}</button>
    `).join("");

    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state"><strong>No requests match this filter</strong><p>Try a different request status to review the queue.</p></div>';
      return;
    }

    container.innerHTML = filtered.map(item => {
      const statusMeta = getRequestStatusMeta(item.status);
      const createdAt = new Date(item.created || Date.now());
      const residentName = item.name || item.residentUser || "Resident";
      const initial = (residentName.trim().charAt(0) || "R").toUpperCase();
      return `
        <div class="request-overview-item">
          <div class="request-overview-main">
            <div class="request-avatar large">${escapeHTML(initial)}</div>
            <div class="request-overview-copy">
              <div class="request-heading-row">
                <span class="request-id">${escapeHTML(item.id)}</span>
                <span class="priority-badge priority-${String(item.priority || "Normal").toLowerCase()}">${escapeHTML(item.priority || "Normal")}</span>
              </div>
              <h4>${escapeHTML(item.subject || item.type || "Service Request")}</h4>
              <div class="request-meta-row">
                <span>${escapeHTML(item.name || item.residentUser || "Resident")}</span>
                <span>•</span>
                <span>${escapeHTML(item.type || "Service")}</span>
                <span>•</span>
                <span>${escapeHTML(createdAt.toLocaleString([], { dateStyle: "short", timeStyle: "short" }))}</span>
              </div>
            </div>
          </div>
          <div class="request-overview-footer">
            <span class="status-badge status-${statusMeta.className}">${escapeHTML(statusMeta.label)}</span>
            <div class="request-overview-actions">
              <button class="btn btn-outline btn-small" data-request-detail="${escapeHTML(item.id)}">View Details</button>
              <select class="status-select" data-request-status="${escapeHTML(item.id)}" aria-label="Change ${escapeHTML(item.id)} status">
                ${REQUEST_STATUS_ORDER.map(status => `<option value="${escapeHTML(status)}" ${normalizeRequestStatus(item.status) === status ? "selected" : ""}>${escapeHTML(status)}</option>`).join("")}
              </select>
              ${normalizeRequestStatus(item.status) === "Pending" ? `
                <button class="btn btn-primary btn-small" data-request-action="Approved" data-request-id="${escapeHTML(item.id)}">Approve</button>
                <button class="btn btn-danger btn-small" data-request-action="Rejected" data-request-id="${escapeHTML(item.id)}">Reject</button>
              ` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function openRequestOverview(filter = "All"){
    const pending = requests().filter(item => normalizeRequestStatus(item.status) === "Pending").length;
    const nextFilter = filter && filter !== "All" ? filter : (pending ? "Pending" : "All");
    renderRequestsOverview(nextFilter);
    showModal("requestsOverviewModal");
  }

  function buildRequestHistoryMarkup(request){
    const history = getRequestHistory(request);
    const items = history.slice().reverse().map(entry => {
      const meta = getRequestStatusMeta(entry.status);
      return `
        <div class="request-history-item">
          <span class="status-badge status-${meta.className}">${escapeHTML(meta.label)}</span>
          <small>${new Date(entry.at || Date.now()).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</small>
        </div>
      `;
    }).join("");

    return items || '<div class="empty-state small-empty">No history recorded.</div>';
  }

  function renderRequestDetails(requestId){
    const request = requests().find(item => item.id === requestId);
    const content = $("#requestDetailContent");
    if (!content) return;
    if (!request) {
      content.innerHTML = '<div class="empty-state"><strong>Request not found</strong><p>The selected request could not be found in the current local data.</p></div>';
      return;
    }

    const statusMeta = getRequestStatusMeta(request.status);
    const createdAt = new Date(request.created || Date.now());
    const residentName = request.name || request.residentUser || "Resident";
    const notes = request.details || request.subject || "No additional notes provided.";

    content.innerHTML = `
      <div class="request-detail-header">
        <div class="request-detail-summary">
          <div class="request-avatar large">${escapeHTML((residentName.trim().charAt(0) || "R").toUpperCase())}</div>
          <div>
            <p class="request-detail-label">Resident</p>
            <h3>${escapeHTML(residentName)}</h3>
          </div>
        </div>
        <span class="status-badge status-${statusMeta.className}">${escapeHTML(statusMeta.label)}</span>
      </div>
      <div class="request-detail-grid">
        <div class="request-detail-box"><span>Request ID</span><strong>${escapeHTML(request.id)}</strong></div>
        <div class="request-detail-box"><span>Service</span><strong>${escapeHTML(request.type || "Service")}</strong></div>
        <div class="request-detail-box"><span>Purpose</span><strong>${escapeHTML(request.subject || "—")}</strong></div>
        <div class="request-detail-box"><span>Priority</span><strong>${escapeHTML(request.priority || "Normal")}</strong></div>
        <div class="request-detail-box"><span>Date Submitted</span><strong>${escapeHTML(createdAt.toLocaleString([], { dateStyle: "short", timeStyle: "short" }))}</strong></div>
        <div class="request-detail-box"><span>Current Status</span><strong>${escapeHTML(statusMeta.label)}</strong></div>
      </div>
      <div class="request-detail-section">
        <h4>Request Notes</h4>
        <p>${escapeHTML(notes)}</p>
      </div>
      <div class="request-detail-section">
        <div class="request-detail-section-head">
          <h4>Request History</h4>
          <div class="request-progress-track mini"><span style="width: ${getRequestProgress(request.status)}%"></span></div>
        </div>
        <div class="request-history-list">${buildRequestHistoryMarkup(request)}</div>
      </div>
      <div class="request-detail-actions">
        ${normalizeRequestStatus(request.status) === "Pending" ? `
          <button class="btn btn-primary" data-request-action="Approved" data-request-id="${escapeHTML(request.id)}">Approve Request</button>
          <button class="btn btn-danger" data-request-action="Rejected" data-request-id="${escapeHTML(request.id)}">Reject Request</button>
        ` : ''}
        <select class="status-select" data-request-status="${escapeHTML(request.id)}" aria-label="Change ${escapeHTML(request.id)} status">
          ${REQUEST_STATUS_ORDER.map(status => `<option value="${escapeHTML(status)}" ${normalizeRequestStatus(request.status) === status ? "selected" : ""}>${escapeHTML(status)}</option>`).join("")}
        </select>
        <button class="btn btn-outline" data-close="requestDetailModal">Close</button>
      </div>
    `;
  }

  function updateRequestStatus(requestId, status, options = {}){
    const { requireConfirm = true, afterUpdate } = options;
    const list = requests();
    const item = list.find(entry => entry.id === requestId);
    if (!item) return;
    const safeStatus = normalizeRequestStatus(status);
    if (safeStatus === normalizeRequestStatus(item.status)) return;
    if (requireConfirm && !window.confirm(`Change this request to ${safeStatus}?`)) return;
    const detailOpen = $("#requestDetailModal")?.getAttribute("aria-hidden") === "false";
    const overviewOpen = $("#requestsOverviewModal")?.getAttribute("aria-hidden") === "false";
    const overviewFilter = $(".request-filter.active")?.dataset.requestFilter || "All";
    item.status = safeStatus;
    item.updatedAt = new Date().toISOString();
    item.statusHistory = Array.isArray(item.statusHistory) ? item.statusHistory : [];
    item.statusHistory.push({ status: safeStatus, at: item.updatedAt });
    write(KEY.requests, list);
    toast(`Request ${requestId} marked as ${safeStatus}.`);
    if (typeof afterUpdate === 'function') afterUpdate(item);
    updateUI();
    if (detailOpen) renderRequestDetails(requestId);
    if (overviewOpen) renderRequestsOverview(overviewFilter);
  }

  const MESSAGE_PRIORITY_ORDER = ["Low", "Normal", "High", "Urgent"];
  const MESSAGE_PRIORITY_META = {
    Low: { label: "Low" },
    Normal: { label: "Normal" },
    High: { label: "High" },
    Urgent: { label: "Urgent" }
  };

  const CONTACT_SUBJECT_OPTIONS = [
    "General Inquiry",
    "Barangay Clearance",
    "Certificate of Indigency",
    "Certificate of Residency",
    "Business Clearance",
    "Barangay ID",
    "Health Services",
    "Appointment Inquiry",
    "Document Requirements",
    "Assistance Request",
    "Complaint / Concern",
    "Community Events",
    "Emergency / Urgent Concern",
    "Other"
  ];

  function normalizeMessageSubject(value){
    const subject = String(value || "").trim();
    return subject || "General Inquiry";
  }

  function toggleOtherSubjectField(){
    const selectedValue = $("#csubject")?.value || "";
    const wrap = $("#csubjectOtherWrap");
    const otherInput = $("#csubjectOther");
    if (!wrap || !otherInput) return;
    const isOther = selectedValue === "Other";
    wrap.classList.toggle("hidden", !isOther);
    if (!isOther) {
      otherInput.value = "";
      $("#csubjectOtherError").textContent = "";
    }
  }

  function normalizeMessagePriority(value){
    const priority = String(value || "Normal").trim();
    return MESSAGE_PRIORITY_ORDER.includes(priority) ? priority : "Normal";
  }

  function formatMessageDateTime(value){
    const date = new Date(value || Date.now());
    return {
      date: date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
      time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    };
  }

  function getMessageNextId(){
    const all = messages();
    let highest = 0;
    all.forEach(item => {
      const match = String(item?.id || "").match(/MSG-(\d+)/i);
      if (match) highest = Math.max(highest, Number(match[1]) || 0);
    });
    return `MSG-${String(highest + 1).padStart(4, "0")}`;
  }

  function getUnreadMessageCount(){
    return messages().filter(item => String(item?.status || "Unread").toLowerCase() === "unread").length;
  }

  function renderMessageBadge(){
    const badge = $("#messageBadge");
    const btn = $("#adminMessagesNavBtn");
    const count = getUnreadMessageCount();
    if (!badge || !btn) return;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("hidden");
      btn.classList.remove("hidden");
      return;
    }
    badge.classList.add("hidden");
    btn.classList.add("hidden");
  }

  function setMessageStatus(messageId, status){
    const list = messages();
    const item = list.find(entry => entry.id === messageId);
    if (!item) return false;
    item.status = status;
    item.updatedAt = new Date().toISOString();
    write(KEY.messages, list);
    renderDashboard();
    renderAdminMessagesList();
    renderMessageBadge();
    return true;
  }

  function updateMessagePriority(messageId, priority){
    const list = messages();
    const item = list.find(entry => entry.id === messageId);
    if (!item) return false;
    item.priority = normalizeMessagePriority(priority);
    item.updatedAt = new Date().toISOString();
    write(KEY.messages, list);
    renderDashboard();
    renderAdminMessagesList();
    return true;
  }

  function addMessageReply(messageId, sender, replyText){
    const list = messages();
    const item = list.find(entry => entry.id === messageId);
    if (!item) return false;
    const trimmed = String(replyText || "").trim();
    if (!trimmed) return false;
    const reply = {
      sender,
      message: trimmed,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    item.replies = Array.isArray(item.replies) ? item.replies : [];
    item.replies.push(reply);
    item.status = sender === "admin" ? "Read" : "Unread";
    item.updatedAt = reply.timestamp;
    write(KEY.messages, list);
    renderDashboard();
    renderAdminMessagesList();
    renderMessageDetail(messageId);
    renderMessageBadge();
    return true;
  }

  function renderRecentMessages(){
    const list = $("#recentMessagesList");
    if (!list) return;
    const items = messages().slice().sort((a, b) => new Date(b.timestamp || b.created || 0) - new Date(a.timestamp || a.created || 0)).slice(0, 5);
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><strong>No messages yet</strong><p>Contact messages from residents will appear here.</p></div>';
      return;
    }
    list.innerHTML = items.map(item => {
      const preview = String(item.message || "").trim();
      const meta = formatMessageDateTime(item.timestamp || item.created || Date.now());
      const statusClass = String(item.status || "Unread").toLowerCase();
      const priorityClass = normalizeMessagePriority(item.priority).toLowerCase();
      return `
        <button class="recent-message-item ${statusClass === "unread" ? "unread" : "read"}" data-message-detail="${escapeHTML(item.id)}" type="button">
          <div class="recent-message-head">
            <div class="recent-message-avatar">${escapeHTML((item.fullName || item.name || "R").trim().charAt(0).toUpperCase() || "R")}</div>
            <div class="recent-message-copy">
              <strong>${escapeHTML(item.fullName || item.name || "Resident")}</strong>
              <span>${escapeHTML(item.subject || "General Inquiry")}</span>
            </div>
          </div>
          <p>${escapeHTML(preview.length > 90 ? preview.slice(0, 90) + "..." : preview)}</p>
          <div class="recent-message-meta">
            <small>${escapeHTML(meta.date)} • ${escapeHTML(meta.time)}</small>
            <span class="status-badge status-${statusClass}">${escapeHTML(item.status || "Unread")}</span>
            <span class="priority-badge priority-${priorityClass}">${escapeHTML(normalizeMessagePriority(item.priority))}</span>
          </div>
        </button>
      `;
    }).join("");
  }

  function renderAdminMessagesList(){
    const list = $("#messageList");
    const panel = $("#messageDetailPane");
    const searchInput = $("#messageSearchInput");
    const filterButtons = $$(".message-filter");
    const sortSelect = $("#messageSort");
    if (!list) return;

    const currentFilter = (document.querySelector(".message-filter.active") || {}).dataset?.messageFilter || "All";
    const subjectFilter = $("#messageSubjectFilter")?.value || "All";
    const searchValue = (searchInput?.value || "").trim().toLowerCase();
    const sortValue = sortSelect?.value || "newest";
    let items = messages().slice();

    items = items.filter(item => {
      const itemSubject = item.subjectCategory || item.subject || "General Inquiry";
      const matchesFilter = (() => {
        if (currentFilter === "All") return true;
        if (currentFilter === "Unread") return (item.status || "Unread") === "Unread";
        if (currentFilter === "Read") return (item.status || "Unread") === "Read";
        if (currentFilter === "High Priority") return normalizeMessagePriority(item.priority) === "High";
        if (currentFilter === "Urgent") return normalizeMessagePriority(item.priority) === "Urgent";
        return true;
      })();
      const matchesSubjectFilter = subjectFilter === "All" || itemSubject === subjectFilter || (subjectFilter === "Other" && (item.subjectCategory === "Other" || item.subject === "Other"));
      if (!matchesFilter || !matchesSubjectFilter) return false;
      if (!searchValue) return true;
      const haystack = [
        item.id,
        item.fullName,
        item.email,
        item.subject,
        item.message,
        item.contactNumber,
        item.status,
        item.priority
      ].join(" ").toLowerCase();
      return haystack.includes(searchValue);
    });

    items.sort((a, b) => {
      const aTime = new Date(a.timestamp || a.created || Date.now()).getTime();
      const bTime = new Date(b.timestamp || b.created || Date.now()).getTime();
      if (sortValue === "oldest") return aTime - bTime;
      if (sortValue === "unread") {
        const unreadDiff = Number((b.status || "Unread") === "Unread") - Number((a.status || "Unread") === "Unread");
        if (unreadDiff !== 0) return unreadDiff;
        return bTime - aTime;
      }
      if (sortValue === "priority") {
        const rank = { Urgent: 4, High: 3, Normal: 2, Low: 1 };
        const diff = rank[normalizeMessagePriority(b.priority)] - rank[normalizeMessagePriority(a.priority)];
        if (diff !== 0) return diff;
        return bTime - aTime;
      }
      return bTime - aTime;
    });

    const selectedCount = selectedMessageIds.size;
    const bulkInfo = $("#bulkSelectionInfo");
    if (bulkInfo) bulkInfo.textContent = selectedCount ? `${selectedCount} message${selectedCount > 1 ? "s" : ""} selected` : "No messages selected";

    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><span>📩</span><h3>No messages found</h3><p>Try a different search or filter.</p></div>';
      if (panel) panel.innerHTML = '<div class="empty-state"><span>📩</span><h3>No message selected</h3><p>Choose a message from the inbox to view details.</p></div>';
      return;
    }

    list.innerHTML = items.map(item => {
      const isSelected = selectedMessageIds.has(item.id);
      const status = String(item.status || "Unread");
      const priority = normalizeMessagePriority(item.priority);
      const preview = String(item.message || "").trim();
      const created = formatMessageDateTime(item.timestamp || item.created || Date.now());
      const subjectLabel = normalizeMessageSubject(item.subject || item.subjectCategory || "General Inquiry");
      return `
        <article class="message-item ${status === "Unread" ? "unread" : "read"} ${isSelected ? "selected" : ""}">
          <label class="message-check">
            <input type="checkbox" data-message-select="${escapeHTML(item.id)}" ${isSelected ? "checked" : ""}>
          </label>
          <button class="message-item-main" type="button" data-message-detail="${escapeHTML(item.id)}">
            <div class="message-item-header">
              <div>
                <strong>${escapeHTML(item.fullName || item.name || "Resident")}</strong>
                <small>${escapeHTML(item.id)}</small>
              </div>
              <span class="priority-badge priority-${priority.toLowerCase()}">${escapeHTML(priority)}</span>
            </div>
            <h4>${escapeHTML(subjectLabel)}</h4>
            <p>${escapeHTML(preview.length > 90 ? preview.slice(0, 90) + "..." : preview)}</p>
            <div class="message-item-meta">
              <span>${escapeHTML(created.date)} • ${escapeHTML(created.time)}</span>
              <span class="status-badge status-${(status || "Unread").toLowerCase().replace(/\s+/g, "-")}">${escapeHTML(status)}</span>
            </div>
          </button>
        </article>
      `;
    }).join("");

    if (panel && !panel.dataset.messageId) {
      const firstMessage = items[0];
      if (firstMessage) {
        renderMessageDetail(firstMessage.id);
      }
    }

    filterButtons.forEach(button => button.classList.toggle("active", button.dataset.messageFilter === currentFilter));
  }

  function renderMessageDetail(messageId){
    const panel = $("#messageDetailPane");
    if (!panel) return;
    const item = messages().find(entry => entry.id === messageId);
    if (!item) {
      panel.innerHTML = '<div class="empty-state"><strong>No message selected</strong><p>Choose a message from the inbox.</p></div>';
      panel.dataset.messageId = "";
      return;
    }
    const liveItem = messages().find(entry => entry.id === messageId) || item;
    const created = formatMessageDateTime(liveItem.timestamp || liveItem.created || Date.now());
    const replies = Array.isArray(liveItem.replies) ? liveItem.replies : [];
    const detailSubject = normalizeMessageSubject(liveItem.subject || liveItem.subjectCategory || "General Inquiry");
    panel.dataset.messageId = liveItem.id;
    panel.innerHTML = `
      <div class="message-detail-top">
        <div>
          <span class="eyebrow">MESSAGE DETAILS</span>
          <h3>${escapeHTML(liveItem.fullName || liveItem.name || "Resident")}</h3>
        </div>
        <div class="message-header-actions">
          <button class="btn btn-small btn-outline" data-message-toggle-read="${escapeHTML(liveItem.id)}" type="button">${(liveItem.status || "Read") === "Unread" ? "Mark as Read" : "Mark as Unread"}</button>
          <button class="btn btn-small btn-danger" data-message-delete="${escapeHTML(liveItem.id)}" type="button">Delete</button>
        </div>
      </div>
      <div class="message-detail-grid">
        <div><span>Full Name</span><strong>${escapeHTML(liveItem.fullName || liveItem.name || "—")}</strong></div>
        <div><span>Email</span><strong><a href="mailto:${escapeHTML(liveItem.email || "")}">${escapeHTML(liveItem.email || "—")}</a></strong></div>
        <div><span>Contact Number</span><strong>${escapeHTML(liveItem.contactNumber || "—")}</strong></div>
        <div><span>Subject</span><strong>${escapeHTML(detailSubject)}</strong></div>
        <div class="full"><span>Message</span><p>${escapeHTML(liveItem.message || "No message provided.")}</p></div>
        <div><span>Submitted</span><strong>${escapeHTML(created.date)} • ${escapeHTML(created.time)}</strong></div>
        <div>
          <span>Priority</span>
          <select class="message-priority-select" data-message-priority="${escapeHTML(liveItem.id)}">
            ${MESSAGE_PRIORITY_ORDER.map(priority => `<option value="${priority}" ${normalizeMessagePriority(liveItem.priority) === priority ? "selected" : ""}>${priority}</option>`).join("")}
          </select>
        </div>
        <div><span>Status</span><strong class="status-badge status-${String(liveItem.status || "Unread").toLowerCase().replace(/\s+/g, "-")}">${escapeHTML(liveItem.status || "Unread")}</strong></div>
      </div>
      <div class="message-reply-box">
        <h4>Reply</h4>
        <form class="admin-reply-form" data-message-id="${escapeHTML(liveItem.id)}">
          <label>To</label>
          <input value="${escapeHTML(liveItem.email || "")}" readonly>
          <label>Subject</label>
          <input value="Re: ${escapeHTML(liveItem.subject || "General Inquiry")}" readonly>
          <label>Reply</label>
          <textarea name="replyMessage" rows="4" placeholder="Type your reply to the resident..."></textarea>
          <div class="form-actions right">
            <button type="submit" class="btn btn-primary btn-small">Send Reply</button>
          </div>
        </form>
      </div>
      <div class="message-conversation-box">
        <h4>Conversation</h4>
        ${replies.length ? replies.map(reply => `
          <div class="conversation-item ${reply.sender === "admin" ? "admin" : "resident"}">
            <div class="conversation-role">${reply.sender === "admin" ? "Admin" : "Resident"}</div>
            <p>${escapeHTML(reply.message || "")}</p>
            <small>${new Date(reply.timestamp || reply.createdAt || Date.now()).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</small>
          </div>
        `).join("") : '<div class="empty-state small">No replies yet.</div>'}
      </div>
    `;
  }

  function markSelectedMessages(action){
    const ids = [...selectedMessageIds];
    if (!ids.length) return;
    const list = messages();
    ids.forEach(id => {
      const item = list.find(entry => entry.id === id);
      if (!item) return;
      if (action === "read") item.status = "Read";
      if (action === "unread") item.status = "Unread";
      if (action === "delete") {
        const index = list.findIndex(entry => entry.id === id);
        if (index >= 0) list.splice(index, 1);
      }
    });
    if (action !== "delete") write(KEY.messages, list);
    else write(KEY.messages, list);
    selectedMessageIds.clear();
    renderDashboard();
    renderAdminMessagesList();
    renderMessageBadge();
    if (action === "delete") {
      const panel = $("#messageDetailPane");
      if (panel) panel.innerHTML = '<div class="empty-state"><strong>Message deleted</strong><p>Select another message from the inbox.</p></div>';
    }
  }

  let selectedMessageIds = new Set();

  toggleOtherSubjectField();

  function renderDashboard(){
    const admin=getAdmin(),r=getResident();
    $("#guestDashboard").classList.toggle("hidden",!!(admin||r));
    $("#residentDashboard").classList.toggle("hidden",!r||!!admin);
    $("#adminDashboard").classList.toggle("hidden",!admin);
    $("#dashboardRole").textContent=admin?"Administrator":r?"Resident":"Guest";
    $("#dashboardTitle").textContent=admin?"Barangay administration dashboard":r?`Welcome back, ${r.fullname||r.username}`:"Your Barangay Connect dashboard";
    if(r&&!admin){
      const myA=appointments().filter(a=>a.residentUser===r.username),myR=requests().filter(a=>a.residentUser===r.username);
      $("#myAppointmentCount").textContent=myA.length;$("#myRequestCount").textContent=myR.length;$("#residentDashName").textContent=r.username;
      $("#residentAppointmentsList").innerHTML=renderList(myA.slice().reverse().slice(0,6),"appointment");
      $("#residentRequestsList").innerHTML=renderList(myR.slice().reverse().slice(0,6),"request");
    }
    if(admin){
      const unreadCount = getUnreadMessageCount();
      $("#adminResidentsCount").textContent=residents().length;$("#adminAppointmentsCount").textContent=appointments().length;
      $("#adminRequestsCount").textContent=requests().filter(x=>x.status==="Pending").length;$("#adminMessagesCount").textContent=messages().length;$("#adminMessagesMeta").textContent=`${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`;
      $("#adminAppointmentsList").innerHTML=renderList(appointments().slice().reverse().slice(0,6),"appointment");
      renderRecentMessages();
      renderRecentRequests();
      renderAppointmentQueue();
      renderAdminMessagesList();
      renderMessageBadge();
    }
  }
  function renderList(arr,type){
    if(!arr.length)return '<div class="empty-state">Nothing to show yet.</div>';
    return arr.map(x=>type==="appointment"
      ? `<div class="list-item"><span class="status-dot"></span><div class="grow"><strong>${escapeHTML(x.serviceType)}</strong><small>${escapeHTML(x.name)} • ${escapeHTML(x.date)} • ${formatTime(x.time)}</small></div><span class="pill">${escapeHTML(x.status||"Pending")}</span></div>`
      : `<div class="list-item"><span class="status-dot ${x.status==="Completed"?"done":""}"></span><div class="grow"><strong>${escapeHTML(x.subject)}</strong><small>${escapeHTML(x.id)} • ${escapeHTML(x.type)}</small></div><span class="pill ${normalizeRequestStatus(x.status).toLowerCase().replace(/\s+/g, "-")}">${escapeHTML(normalizeRequestStatus(x.status))}</span></div>`
    ).join("");
  }
  $("#openAdminRequests")?.addEventListener("click",()=>{
    openRequestOverview();
  });
  $("#openAdminMessages")?.addEventListener("click",()=>{
    $("#adminMessages")?.scrollIntoView({behavior:"smooth"});
  });
  $("#openAdminMessagesFromRecent")?.addEventListener("click",()=>{
    $("#adminMessages")?.scrollIntoView({behavior:"smooth"});
  });
  $("#adminMessagesNavBtn")?.addEventListener("click",()=>{
    $("#adminMessages")?.scrollIntoView({behavior:"smooth"});
  });
  $("#messageSearchInput")?.addEventListener("input", renderAdminMessagesList);
  $("#messageSort")?.addEventListener("change", renderAdminMessagesList);
  $("#messageSubjectFilter")?.addEventListener("change", renderAdminMessagesList);
  $$(".message-filter").forEach(button => {
    button.addEventListener("click", () => {
      $$(".message-filter").forEach(item => item.classList.toggle("active", item === button));
      renderAdminMessagesList();
    });
  });
  document.addEventListener("click", e => {
    const detailBtn = e.target.closest("[data-request-detail]");
    const actionBtn = e.target.closest("[data-request-action]");
    const filterBtn = e.target.closest("[data-request-filter]");
    const messageDetailBtn = e.target.closest("[data-message-detail]");
    const messageDeleteBtn = e.target.closest("[data-message-delete]");
    const messageToggleReadBtn = e.target.closest("[data-message-toggle-read]");
    const bulkBtn = e.target.closest("[data-bulk-action]");

    if (detailBtn) {
      renderRequestDetails(detailBtn.dataset.requestDetail);
      showModal("requestDetailModal");
      return;
    }

    if (actionBtn) {
      const requestId = actionBtn.dataset.requestId;
      const status = actionBtn.dataset.requestAction;
      if (!requestId || !status) return;
      updateRequestStatus(requestId, status, { requireConfirm: true });
      return;
    }

    if (filterBtn) {
      renderRequestsOverview(filterBtn.dataset.requestFilter || "All");
      return;
    }

    if (messageDetailBtn) {
      const id = messageDetailBtn.dataset.messageDetail;
      const item = messages().find(entry => entry.id === id);
      if (item && (item.status || "Unread") === "Unread") {
        setMessageStatus(id, "Read");
      }
      renderMessageDetail(id);
      return;
    }

    if (messageDeleteBtn) {
      const id = messageDeleteBtn.dataset.messageDelete;
      if (!id) return;
      if (!window.confirm("Are you sure you want to delete this message?")) return;
      const list = messages().filter(item => item.id !== id);
      write(KEY.messages, list);
      selectedMessageIds.delete(id);
      renderDashboard();
      renderAdminMessagesList();
      renderMessageBadge();
      return;
    }

    if (messageToggleReadBtn) {
      const id = messageToggleReadBtn.dataset.messageToggleRead;
      if (!id) return;
      const item = messages().find(entry => entry.id === id);
      if (!item) return;
      setMessageStatus(id, (item.status || "Read") === "Unread" ? "Read" : "Unread");
      return;
    }

    if (bulkBtn) {
      markSelectedMessages(bulkBtn.dataset.bulkAction);
    }
  });

  document.addEventListener("change", e => {
    const select = e.target.closest("[data-appointment-status]");
    if (select) {
      updateAppointmentStatus(select.dataset.appointmentStatus, select.value);
      return;
    }

    const prioritySelect = e.target.closest("[data-message-priority]");
    if (prioritySelect) {
      updateMessagePriority(prioritySelect.dataset.messagePriority, prioritySelect.value);
      return;
    }

    const requestStatusSelect = e.target.closest("[data-request-status]");
    if (requestStatusSelect) {
      updateRequestStatus(requestStatusSelect.dataset.requestStatus, requestStatusSelect.value, { requireConfirm: false });
    }
  });

  document.addEventListener("submit", e => {
    const form = e.target.closest(".admin-reply-form");
    if (!form) return;
    e.preventDefault();
    const id = form.dataset.messageId;
    const textarea = form.querySelector("textarea[name='replyMessage']");
    if (!id || !textarea) return;
    const value = textarea.value.trim();
    if (!value) {
      toast("Please enter a reply before sending.");
      return;
    }
    addMessageReply(id, "admin", value);
    textarea.value = "";
    toast("Reply saved successfully.");
  });

  document.addEventListener("click", e => {
    const checkbox = e.target.closest("[data-message-select]");
    if (!checkbox) return;
    const id = checkbox.dataset.messageSelect;
    if (!id) return;
    if (checkbox.checked) selectedMessageIds.add(id);
    else selectedMessageIds.delete(id);
    renderAdminMessagesList();
  });

  // Records
  let selectedRecordId=null;
  function renderRecords(filter=""){
    if(!getAdmin())return;
    const tbody=$("#recordsTable tbody"),empty=$("#recordsEmpty"),q=filter.toLowerCase();
    const residentAccounts=residents();
    const arr=records().filter(r=>{
      const acc=residentAccounts.find(x=>(r.residentUser&&x.username===r.residentUser)||(x.fullname&&r.name&&x.fullname.toLowerCase()===r.name.toLowerCase()));
      const hay=[r.id,r.name,r.age,r.address,r.residentUser,acc?.username,acc?.email,acc?.barangay,acc?.purok,acc?.fullname].join(" ").toLowerCase();
      return hay.includes(q);
    });
    tbody.innerHTML=arr.map(r=>{
      const acc=residentAccounts.find(x=>(r.residentUser&&x.username===r.residentUser)||(x.fullname&&r.name&&x.fullname.toLowerCase()===r.name.toLowerCase()));
      const ap=appointments().filter(a=>(r.residentUser&&a.residentUser===r.residentUser)||(a.recordId&&a.recordId===r.id)||(a.name&&a.name.toLowerCase()===r.name.toLowerCase()));
      return `<tr><td><b>${escapeHTML(r.id)}</b></td><td><strong>${escapeHTML(acc?.fullname||r.name||"—")}</strong><small class="table-subtext">${escapeHTML(acc?.email||r.email||r.residentUser||"")}</small></td><td>${escapeHTML(r.age||"—")}</td><td><span class="pill">${ap.length}</span></td><td><div class="table-actions"><button class="icon-btn" data-record-view="${r.id}">View details</button><button class="icon-btn" data-record-edit="${r.id}">Edit</button><button class="icon-btn delete" data-record-delete="${r.id}">Delete</button></div></td></tr>`;
    }).join("");
    empty.classList.toggle("hidden",arr.length>0);
  }
  const appointmentStatuses=["Pending","Approved","Rejected","Completed","Cancelled"];
  function appointmentStatusClass(status){return String(status||"Pending").toLowerCase();}
  function renderAppointmentQueue(){
    if(!getAdmin())return;
    const tbody=$("#adminAppointmentsTable tbody"),empty=$("#appointmentsEmpty"),filter=$("#appointmentStatusFilter")?.value||"All";
    const arr=appointments().slice().reverse().filter(a=>filter==="All"||a.status===filter);
    tbody.innerHTML=arr.map(a=>`<tr><td><strong>${escapeHTML(a.name||a.residentUser||"—")}</strong><small class="table-subtext">${escapeHTML(a.id)}</small></td><td>${escapeHTML(a.serviceType||"—")}</td><td>${escapeHTML(a.date||"—")}<small class="table-subtext">${escapeHTML(a.time?formatTime(a.time):"—")}</small></td><td><span class="pill ${appointmentStatusClass(a.status)}">${escapeHTML(a.status||"Pending")}</span></td><td><div class="table-actions">${a.status==="Pending"?`<button class="icon-btn approve-btn" data-appointment-action="Approved" data-appointment-id="${escapeHTML(a.id)}">Approve</button><button class="icon-btn reject-btn" data-appointment-action="Rejected" data-appointment-id="${escapeHTML(a.id)}">Reject</button>`:""}<select class="status-select" data-appointment-status="${escapeHTML(a.id)}" aria-label="Change ${escapeHTML(a.id)} status">${appointmentStatuses.map(status=>`<option ${status===(a.status||"Pending")?"selected":""}>${status}</option>`).join("")}</select><button class="icon-btn" data-appointment-history="${escapeHTML(a.id)}">History</button></div></td></tr>`).join("");
    empty.classList.toggle("hidden",arr.length>0);
  }
  function updateAppointmentStatus(id,status){
    const arr=appointments(),item=arr.find(a=>a.id===id);if(!item||!appointmentStatuses.includes(status))return;
    if(item.status===status)return;
    item.status=status;item.statusHistory=Array.isArray(item.statusHistory)?item.statusHistory:[];item.statusHistory.push({status,at:new Date().toISOString()});write(KEY.appointments,arr);toast(`${id} marked ${status}.`);updateUI();
  }
  function renderAppointmentHistory(item){
    const history=Array.isArray(item.statusHistory)&&item.statusHistory.length?item.statusHistory:[{status:item.status||"Pending",at:item.created}];
    return `<div class="appointment-history-item"><div><strong>${escapeHTML(item.serviceType||"Appointment")}</strong><small>${escapeHTML(item.date||"—")} at ${escapeHTML(item.time?formatTime(item.time):"—")} • ${escapeHTML(item.id)}</small></div><div class="appointment-history-status"><select class="status-select" data-appointment-status="${escapeHTML(item.id)}" aria-label="Change ${escapeHTML(item.id)} status">${appointmentStatuses.map(status=>`<option ${status===(item.status||"Pending")?"selected":""}>${status}</option>`).join("")}</select></div><div class="status-timeline">${history.slice().reverse().map(entry=>`<span><b class="pill ${appointmentStatusClass(entry.status)}">${escapeHTML(entry.status)}</b><small>${entry.at?new Date(entry.at).toLocaleString():""}</small></span>`).join("")}</div></div>`;
  }
  $("#searchRecords")?.addEventListener("input",e=>renderRecords(e.target.value));
  $("#appointmentStatusFilter")?.addEventListener("change",renderAppointmentQueue);
  $("#addRecordBtn")?.addEventListener("click",()=>openRecordForm());
  document.addEventListener("click",e=>{
    const view=e.target.closest("[data-record-view]"),edit=e.target.closest("[data-record-edit]"),del=e.target.closest("[data-record-delete]");
    const history=e.target.closest("[data-appointment-history]");
    const appointmentAction=e.target.closest("[data-appointment-action]");
    if(view)showRecord(view.dataset.recordView);
    if(edit)openRecordForm(edit.dataset.recordEdit);
    if(del)deleteRecord(del.dataset.recordDelete);
    if(appointmentAction)updateAppointmentStatus(appointmentAction.dataset.appointmentId,appointmentAction.dataset.appointmentAction);
    if(history){const item=appointments().find(a=>a.id===history.dataset.appointmentHistory);if(item){selectedRecordId=item.recordId;const record=records().find(r=>r.id===item.recordId);if(record)showRecord(record.id);else toast("Resident record not found.");}}
  });
  document.addEventListener("change",e=>{const select=e.target.closest("[data-appointment-status]");if(select)updateAppointmentStatus(select.dataset.appointmentStatus,select.value);});
  function showRecord(id){
    const r=records().find(x=>x.id===id);if(!r)return;selectedRecordId=id;
    const acc=residents().find(x=>(r.residentUser&&x.username===r.residentUser)||(x.fullname&&r.name&&x.fullname.toLowerCase()===r.name.toLowerCase()));
    const username=acc?.username||r.residentUser||"—", email=acc?.email||r.email||"—", barangay=acc?.barangay||r.barangay||"—", purok=acc?.purok||r.purok||"—";
    $("#recordInfo").innerHTML=`<div class="record-detail-grid"><div class="record-detail"><span>Resident ID</span><strong>${escapeHTML(r.id)}</strong></div><div class="record-detail"><span>Full Name</span><strong>${escapeHTML(acc?.fullname||r.name||"—")}</strong></div><div class="record-detail"><span>Age</span><strong>${escapeHTML(r.age||"—")}</strong></div><div class="record-detail"><span>Username</span><strong>${escapeHTML(username)}</strong></div><div class="record-detail"><span>Email</span><strong>${escapeHTML(email)}</strong></div><div class="record-detail"><span>Barangay</span><strong>${escapeHTML(barangay)}</strong></div><div class="record-detail"><span>Purok</span><strong>${escapeHTML(purok)}</strong></div><div class="record-detail"><span>Address</span><strong>${escapeHTML(r.address||[purok,barangay].filter(x=>x!=="—").join(", ")||"—")}</strong></div><div class="record-detail"><span>Account Created</span><strong>${escapeHTML(acc?.created?new Date(acc.created).toLocaleString():"—")}</strong></div></div>`;
    const ap=appointments().filter(a=>(r.residentUser && a.residentUser===r.residentUser) || (a.recordId && a.recordId===r.id) || (a.name && a.name.toLowerCase()===r.name.toLowerCase()));
    $("#recordAppointmentCount").textContent=ap.length;$("#recordAppointments").innerHTML=ap.length?ap.slice().reverse().map(renderAppointmentHistory).join(""):'<div class="empty-state">No appointment history for this resident.</div>';showModal("recordModal");
  }
  function openRecordForm(id=null){
    selectedRecordId=id;
    const r=id?records().find(x=>x.id===id):null;
    $("#recordEditTitle").textContent=r?"Edit Resident":"Add Resident";$("#recordId").value=r?.id||"";$("#recordName").value=r?.name||"";$("#recordAge").value=r?.age||"";$("#recordAddress").value=r?.address||"";$("#recordFormMessage").textContent="";showModal("recordEditModal");
  }
  $("#editRecordBtn")?.addEventListener("click",()=>{hideModal("recordModal");openRecordForm(selectedRecordId);});
  $("#recordForm")?.addEventListener("submit",e=>{
    e.preventDefault();const arr=records(),id=$("#recordId").value||`BR-${Date.now().toString().slice(-5)}`,existing=selectedRecordId?arr.find(x=>x.id===selectedRecordId):null,obj={...existing,id,name:$("#recordName").value.trim(),age:Number($("#recordAge").value),address:$("#recordAddress").value.trim()};
    if(selectedRecordId){const i=arr.findIndex(x=>x.id===selectedRecordId);if(i>=0)arr[i]=obj;}else arr.push(obj);
    write(KEY.records,arr);$("#recordFormMessage").textContent="Record saved.";toast("Resident record saved.");renderRecords($("#searchRecords").value);updateHeroStats();setTimeout(()=>hideModal("recordEditModal"),500);
  });
  function deleteRecord(id){if(!confirm("Delete this resident record?"))return;write(KEY.records,records().filter(r=>r.id!==id));renderRecords($("#searchRecords").value);toast("Record deleted.");updateHeroStats();}

  // Contact
  function validateContactForm(){
    const fullName = $("#cname").value.trim();
    const email = $("#cemail").value.trim();
    const contactNumber = $("#ccontact").value.trim();
    const subject = $("#csubject").value.trim();
    const subjectOther = $("#csubjectOther").value.trim();
    const message = $("#cmessage").value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^(09\d{9}|\+63\d{10}|63\d{10})$/;

    let valid = true;

    const setError = (fieldId, message) => {
      const field = $(fieldId);
      const error = $(fieldId + "Error");
      if (field) field.setAttribute("data-invalid", message ? "true" : "false");
      if (error) {
        error.textContent = message || "";
        error.classList.toggle("error", !!message);
      }
      if (message) valid = false;
    };

    setError("#cname", !fullName ? "Please enter your full name." : "");
    setError("#cemail", !email ? "Please enter your email." : (!emailPattern.test(email) ? "Please enter a valid email address." : ""));
    setError("#ccontact", contactNumber && !phonePattern.test(contactNumber) ? "Please enter a valid Philippine phone number." : "");
    setError("#csubject", !subject ? "Please select a subject." : "");
    const otherVisible = $("#csubject").value === "Other";
    $("#csubjectOtherWrap")?.classList.toggle("hidden", !otherVisible);
    setError("#csubjectOther", otherVisible && !subjectOther ? "Please specify your subject." : "");
    setError("#cmessage", !message ? "Please enter your message." : (message.length < 20 ? "Message should be at least 20 characters long." : ""));

    return valid;
  }

  $("#csubject")?.addEventListener("change", () => {
    toggleOtherSubjectField();
    validateContactForm();
  });

  $("#contactForm")?.addEventListener("submit",e=>{
    e.preventDefault();
    const submitBtn = $("#contactSubmitBtn");
    if (!validateContactForm()) {
      toast("Please correct the highlighted fields.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
    }

    const arr = messages();
    const selectedSubject = $("#csubject").value.trim();
    const customOtherSubject = $("#csubjectOther").value.trim();
    const finalSubject = selectedSubject === "Other" ? customOtherSubject : selectedSubject;
    const item = {
      id: getMessageNextId(),
      fullName: $("#cname").value.trim(),
      email: $("#cemail").value.trim(),
      contactNumber: $("#ccontact").value.trim(),
      subject: finalSubject,
      subjectCategory: selectedSubject,
      message: $("#cmessage").value.trim(),
      status: "Unread",
      priority: "Normal",
      date: new Date().toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }),
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      timestamp: Date.now(),
      created: new Date().toISOString(),
      replies: []
    };

    arr.push(item);
    write(KEY.messages, arr);
    e.target.reset();
    toggleOtherSubjectField();
    $$(".field-error").forEach(node => node.textContent = "");
    $("#contactMessage").textContent = "Message sent successfully! Your message has been received by the Barangay Office.";
    $("#contactMessage").classList.add("success");
    toast("Message sent successfully!");
    updateDashboardOnly();

    setTimeout(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
      }
    }, 700);
  });

  // Admin data tools
  $("#exportData")?.addEventListener("click",()=>{
    if(!getAdmin())return showModal("adminModal");
    const data={exportedAt:new Date().toISOString(),residents:residents(),appointments:appointments(),requests:requests(),records:records(),messages:messages()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="barangay-connect-data.json";a.click();URL.revokeObjectURL(url);toast("Data exported.");
  });
  $("#importData")?.addEventListener("click",()=>getAdmin()?$("#importFile").click():showModal("adminModal"));
  $("#importFile")?.addEventListener("change",e=>{
    const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();
    reader.onload=()=>{try{const d=JSON.parse(reader.result);["residents","appointments","requests","records","messages"].forEach(k=>{if(Array.isArray(d[k]))write(KEY[k],d[k]);});updateUI();toast("Data imported successfully.");}catch{toast("Invalid JSON file.");}e.target.value="";};reader.readAsText(file);
  });
  $("#clearData")?.addEventListener("click",()=>{
    if(!getAdmin())return showModal("adminModal");if(!confirm("Clear all demo appointments, requests, records and messages?"))return;
    [KEY.appointments,KEY.requests,KEY.records,KEY.messages].forEach(k=>localStorage.removeItem(k));setup().then(()=>{updateUI();toast("Demo data cleared.");});
  });

  function updateHeroStats(){
    $("#heroResidents").textContent=residents().length;$("#heroAppointments").textContent=appointments().length;$("#heroRequests").textContent=requests().filter(r=>r.status==="Pending").length;
  }
  function updateDashboardOnly(){renderDashboard();updateHeroStats();}
  $("#year").textContent=new Date().getFullYear();

  setup().then(()=>{
    residents().forEach(syncResidentRecord);
    updateUI();
  }).catch(err=>{
    console.error("Barangay Connect setup failed:", err);
    toast("System setup failed. Please refresh the page.");
  });
});