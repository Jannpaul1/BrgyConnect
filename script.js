document.addEventListener("DOMContentLoaded", () => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const KEY = {
    admins:"bc_admins", residents:"bc_residents", appointments:"bc_appointments",
    requests:"bc_requests", records:"bc_records", messages:"bc_messages",
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
  const messages = () => read(KEY.messages, []);

  const toast = (msg) => {
    const t=$("#toast"); if(!t)return;
    t.textContent=msg; t.classList.add("show"); clearTimeout(window.__toast);
    window.__toast=setTimeout(()=>t.classList.remove("show"),2500);
  };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const showModal = id => { const m=$("#"+id); if(m){m.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden";} };
  const hideModal = id => { const m=$("#"+id); if(m){m.setAttribute("aria-hidden","true");} if(!$$(".modal[aria-hidden='false']").length)document.body.style.overflow=""; };

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
    const arr=requests(),item={id:makeId("REQ"),residentUser:r.username,name:r.fullname||r.username,type:$("#requestType").value,subject:$("#requestSubject").value.trim(),details:$("#requestDetails").value.trim(),email:$("#requestContact").value.trim(),priority:$("#requestPriority").value,status:"Pending",created:new Date().toISOString()};
    arr.push(item);write(KEY.requests,arr);e.target.reset();$("#requestMessage").textContent=`Request submitted. Your ID is ${item.id}.`;toast("Service request submitted.");updateUI();
  });
  function makeId(prefix){const n=Math.floor(1000+Math.random()*9000);return `${prefix}-${n}`;}
  $("#searchRequestBtn")?.addEventListener("click",()=>{
    const id=$("#requestSearch").value.trim().toUpperCase(),result=requests().find(r=>r.id===id),box=$("#requestStatusResult");
    if(!result){box.textContent="No request found. Check the Request ID and try again.";return;}
    box.innerHTML=`<div class="list-item"><span class="status-dot"></span><div class="grow"><strong>${escapeHTML(result.subject)}</strong><small>${escapeHTML(result.type)} • ${new Date(result.created).toLocaleDateString()}</small></div><span class="pill ${result.status.toLowerCase()}">${escapeHTML(result.status)}</span></div><p><b>Request ID:</b> ${escapeHTML(result.id)}</p><p>${escapeHTML(result.details)}</p>`;
  });

  // Dashboard
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
      $("#adminResidentsCount").textContent=residents().length;$("#adminAppointmentsCount").textContent=appointments().length;
      $("#adminRequestsCount").textContent=requests().filter(x=>x.status==="Pending").length;$("#adminMessagesCount").textContent=messages().length;
      $("#adminAppointmentsList").innerHTML=renderList(appointments().slice().reverse().slice(0,6),"appointment");
      $("#adminRequestsList").innerHTML=renderList(requests().slice().reverse().slice(0,6),"request");
      renderAppointmentQueue();
    }
  }
  function renderList(arr,type){
    if(!arr.length)return '<div class="empty-state">Nothing to show yet.</div>';
    return arr.map(x=>type==="appointment"
      ? `<div class="list-item"><span class="status-dot"></span><div class="grow"><strong>${escapeHTML(x.serviceType)}</strong><small>${escapeHTML(x.name)} • ${escapeHTML(x.date)} • ${formatTime(x.time)}</small></div><span class="pill">${escapeHTML(x.status||"Pending")}</span></div>`
      : `<div class="list-item"><span class="status-dot ${x.status==="Completed"?"done":""}"></span><div class="grow"><strong>${escapeHTML(x.subject)}</strong><small>${escapeHTML(x.id)} • ${escapeHTML(x.type)}</small></div><span class="pill ${x.status.toLowerCase()}">${escapeHTML(x.status)}</span></div>`
    ).join("");
  }
  $("#openAdminRequests")?.addEventListener("click",()=>{
    const data=requests();if(!data.length){toast("No service requests yet.");return;}
    const text=data.slice().reverse().slice(0,10).map(x=>`${x.id} — ${x.subject} — ${x.status}`).join("\n");alert("Recent Service Requests\n\n"+text);
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
  $("#contactForm")?.addEventListener("submit",e=>{
    e.preventDefault();const arr=messages();arr.push({id:makeId("MSG"),name:$("#cname").value.trim(),email:$("#cemail").value.trim(),message:$("#cmessage").value.trim(),created:new Date().toISOString()});write(KEY.messages,arr);e.target.reset();$("#contactMessage").textContent="Message sent successfully.";toast("Message sent.");updateDashboardOnly();
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