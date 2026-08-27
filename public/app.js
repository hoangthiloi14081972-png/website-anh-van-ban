let ME=null;
const $=s=>document.querySelector(s);
function toast(msg){const d=document.createElement("div");d.className="toast";d.textContent=msg;$("#toast").appendChild(d);setTimeout(()=>d.remove(),3000)}
async function api(url,opt={}){const r=await fetch(url,opt);let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||"Có lỗi");return d}
function showAuth(x){$("#loginForm").classList.toggle("hidden",x!=="login");$("#registerForm").classList.toggle("hidden",x!=="register")}
function closeModal(){$("#modal").classList.add("hidden")}
function openModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden")}
async function refresh(){
  const d=await api("/api/me");ME=d.user;
  $("#auth").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#admin").classList.toggle("hidden",!ME||ME.role!=="admin");
  $("#newPostBtn").textContent=ME?"+ Đăng bài":"🔐 Đăng nhập để đăng bài";
  $("#nav").innerHTML=ME
    ? `<span>👤 ${esc(ME.username)}</span><button class="secondary" onclick="logout()">Đăng xuất</button>`
    : `<button onclick="showLogin()">Đăng nhập</button><button class="secondary" onclick="showRegister()">Đăng ký</button>`;
  loadPosts();
  if(ME&&ME&&ME.role==="admin")loadUsers();
}
function showLogin(){showAuth("login");$("#auth").classList.remove("hidden");$("#auth").scrollIntoView({behavior:"smooth"})}
function showRegister(){showAuth("register");$("#auth").classList.remove("hidden");$("#auth").scrollIntoView({behavior:"smooth"})}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("#loginForm").onsubmit=async e=>{e.preventDefault();try{const f=new FormData(e.target);await api("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(f))});toast("Đăng nhập thành công");refresh()}catch(x){toast(x.message)}}
$("#registerForm").onsubmit=async e=>{e.preventDefault();try{const f=new FormData(e.target);const d=await api("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(f))});toast(d.message);e.target.reset();showAuth("login")}catch(x){toast(x.message)}}
async function logout(){await api("/api/logout",{method:"POST"});refresh()}
$("#newPostBtn").onclick=()=>{if(!ME){showLogin();return}openModal(`<h2>Đăng bài viết</h2><form id="postForm"><input name="title" placeholder="Tiêu đề" required><textarea name="content" placeholder="Nội dung..." required></textarea><label>Ảnh (tối đa 8MB)<input name="image" type="file" accept="image/*"></label><button>Đăng bài</button></form>`)};
document.addEventListener("submit",async e=>{if(e.target.id!=="postForm")return;e.preventDefault();try{await api("/api/posts",{method:"POST",body:new FormData(e.target)});closeModal();toast("Đã đăng bài");loadPosts()}catch(x){toast(x.message)}})
async function loadPosts(){
 const posts=await api("/api/posts");const box=$("#posts");
 if(!posts.length){box.innerHTML='<div class="card empty">Chưa có bài viết.</div>';return}
 box.innerHTML=posts.map(p=>`<article class="post"><h2>${esc(p.title)}</h2><div class="meta">Bởi ${esc(p.author)} · ${new Date(p.created_at).toLocaleString("vi-VN")} · 💬 ${p.comment_count}</div>${p.image?`<img src="${p.image}" alt="">`:""}<div class="content">${esc(p.content)}</div><div class="actions"><button onclick="viewPost(${p.id})">Xem & bình luận</button>${ME&&ME.role==="admin"?`<button class="secondary" onclick="editPost(${p.id})">Sửa</button><button class="danger" onclick="deletePost(${p.id})">Xóa</button>`:""}</div></article>`).join("")
}
async function viewPost(id){
 const p=await api("/api/posts/"+id);
 openModal(`<h2>${esc(p.title)}</h2><div class="meta">Bởi ${esc(p.author)}</div>${p.image?`<img src="${p.image}" style="width:100%;max-height:380px;object-fit:contain;border-radius:12px">`:""}<div class="content">${esc(p.content)}</div><div class="comments"><h3>Bình luận (${p.comments.length})</h3>${p.comments.map(c=>`<div class="comment"><strong>${esc(c.username)}</strong>${esc(c.content)} ${ME&&ME.role==="admin"?`<button class="danger" style="float:right;padding:5px 9px" onclick="deleteComment(${c.id},${id})">Xóa</button>`:""}</div>`).join("")||"<p class='muted'>Chưa có bình luận.</p>"}${ME?`<form class="commentForm" onsubmit="addComment(event,${id})"><input name="content" placeholder="Viết bình luận..." required><button>Gửi</button></form>`:`<p class="muted">Đăng nhập để bình luận.</p>`}</div>`)
}
async function addComment(e,id){e.preventDefault();try{await api(`/api/posts/${id}/comments`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:e.target.content.value})});viewPost(id);loadPosts()}catch(x){toast(x.message)}}
async function deleteComment(cid,pid){if(!confirm("Xóa bình luận này?"))return;try{await api("/api/comments/"+cid,{method:"DELETE"});viewPost(pid);loadPosts()}catch(x){toast(x.message)}}
async function deletePost(id){if(!confirm("Xóa bài viết này?"))return;try{await api("/api/posts/"+id,{method:"DELETE"});toast("Đã xóa");loadPosts()}catch(x){toast(x.message)}}
async function editPost(id){const p=await api("/api/posts/"+id);openModal(`<h2>Chỉnh sửa bài viết</h2><form onsubmit="saveEdit(event,${id})"><input name="title" value="${esc(p.title)}" required><textarea name="content" required>${esc(p.content)}</textarea><button>Lưu thay đổi</button></form>`)}
async function saveEdit(e,id){e.preventDefault();const f=new FormData(e.target);try{await api("/api/posts/"+id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(f))});closeModal();toast("Đã cập nhật");loadPosts()}catch(x){toast(x.message)}}
async function loadUsers(){const us=await api("/api/admin/users");const box=$("#users");const pending=us.filter(u=>!u.approved&&u.role!=="admin");box.innerHTML=pending.length?pending.map(u=>`<div class="userRow"><div><strong>${esc(u.username)}</strong><br><span class="muted">Đăng ký: ${new Date(u.created_at).toLocaleString("vi-VN")}</span></div><div><button onclick="approve(${u.id})">Duyệt</button><button class="danger" onclick="reject(${u.id})">Từ chối</button></div></div>`).join(""):"<p class='muted'>Không có tài khoản chờ duyệt.</p>"}
async function approve(id){await api("/api/admin/users/"+id+"/approve",{method:"POST"});toast("Đã duyệt tài khoản");loadUsers()}
async function reject(id){if(!confirm("Từ chối và xóa yêu cầu này?"))return;await api("/api/admin/users/"+id+"/reject",{method:"POST"});loadUsers()}
refresh();
