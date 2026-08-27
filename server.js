
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, "uploads");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "site.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user',
 approved INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 content TEXT NOT NULL,
 image TEXT,
 author_id INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT,
 FOREIGN KEY(author_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 content TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

const adminUser = process.env.ADMIN_USER || "admin";
const adminPass = process.env.ADMIN_PASS || "Admin@12345";
const exists = db.prepare("SELECT id FROM users WHERE username=?").get(adminUser);
if (!exists) {
  db.prepare("INSERT INTO users(username,password,role,approved) VALUES(?,?,?,1)")
    .run(adminUser, bcrypt.hashSync(adminPass, 12), "admin");
  console.log(`Tài khoản quản trị mặc định: ${adminUser} / ${adminPass}`);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000*60*60*8
  }
}));
app.use(express.static(path.join(ROOT, "public")));
app.use("/uploads", express.static(path.join(ROOT, "uploads")));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, Date.now() + "-" + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) return cb(new Error("Chỉ nhận JPG, PNG, GIF, WEBP."));
    cb(null, true);
  }
});

function user(req) {
  return req.session.userId ? db.prepare("SELECT id,username,role,approved FROM users WHERE id=?").get(req.session.userId) : null;
}
function requireLogin(req,res,next) {
  const u = user(req);
  if (!u) return res.status(401).json({error:"Bạn cần đăng nhập."});
  if (!u.approved) return res.status(403).json({error:"Tài khoản đang chờ quản trị viên duyệt."});
  req.currentUser=u; next();
}
function requireAdmin(req,res,next) {
  const u = user(req);
  if (!u || u.role !== "admin") return res.status(403).json({error:"Không có quyền quản trị."});
  req.currentUser=u; next();
}

app.get("/health",(req,res)=>res.json({ok:true}));
app.get("/api/me",(req,res)=>res.json({user:user(req)}));

app.post("/api/register",(req,res)=>{
  const username=(req.body.username||"").trim();
  const password=req.body.password||"";
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return res.status(400).json({error:"Tên tài khoản 3-30 ký tự, chỉ dùng chữ, số, _."});
  if (password.length < 6) return res.status(400).json({error:"Mật khẩu tối thiểu 6 ký tự."});
  try {
    db.prepare("INSERT INTO users(username,password) VALUES(?,?)").run(username,bcrypt.hashSync(password,12));
    res.json({ok:true,message:"Đăng ký thành công. Hãy chờ quản trị viên duyệt tài khoản."});
  } catch(e) { res.status(400).json({error:"Tên tài khoản đã tồn tại."}); }
});

app.post("/api/login",(req,res)=>{
  const u=db.prepare("SELECT * FROM users WHERE username=?").get((req.body.username||"").trim());
  if(!u || !bcrypt.compareSync(req.body.password||"",u.password)) return res.status(401).json({error:"Sai tài khoản hoặc mật khẩu."});
  if(!u.approved) return res.status(403).json({error:"Tài khoản chưa được quản trị viên duyệt."});
  req.session.userId=u.id;
  res.json({ok:true,user:{id:u.id,username:u.username,role:u.role}});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get("/api/posts",(req,res)=>{
  const posts=db.prepare(`
    SELECT p.*,u.username author,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comment_count
    FROM posts p JOIN users u ON u.id=p.author_id
    ORDER BY p.id DESC
  `).all();
  res.json(posts);
});
app.get("/api/posts/:id",(req,res)=>{
  const post=db.prepare(`SELECT p.*,u.username author FROM posts p JOIN users u ON u.id=p.author_id WHERE p.id=?`).get(req.params.id);
  if(!post) return res.status(404).json({error:"Không tìm thấy bài viết."});
  const comments=db.prepare(`SELECT c.*,u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id ASC`).all(req.params.id);
  res.json({...post,comments});
});

app.post("/api/posts",requireLogin,upload.single("image"),(req,res)=>{
  const title=(req.body.title||"").trim(), content=(req.body.content||"").trim();
  if(!title || !content) return res.status(400).json({error:"Cần nhập tiêu đề và nội dung."});
  const image=req.file ? "/uploads/"+req.file.filename : null;
  const r=db.prepare("INSERT INTO posts(title,content,image,author_id) VALUES(?,?,?,?)").run(title,content,image,req.currentUser.id);
  res.json({ok:true,id:r.lastInsertRowid});
});

app.put("/api/posts/:id",requireAdmin,(req,res)=>{
  const title=(req.body.title||"").trim(), content=(req.body.content||"").trim();
  if(!title || !content) return res.status(400).json({error:"Tiêu đề và nội dung không được trống."});
  const r=db.prepare("UPDATE posts SET title=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(title,content,req.params.id);
  res.json({ok:r.changes>0});
});
app.delete("/api/posts/:id",requireAdmin,(req,res)=>{
  const p=db.prepare("SELECT image FROM posts WHERE id=?").get(req.params.id);
  if(p?.image) { const f=path.join(UPLOAD_DIR, path.basename(p.image)); if(fs.existsSync(f)) fs.unlinkSync(f); }
  const r=db.prepare("DELETE FROM posts WHERE id=?").run(req.params.id);
  res.json({ok:r.changes>0});
});

app.post("/api/posts/:id/comments",requireLogin,(req,res)=>{
  const content=(req.body.content||"").trim();
  if(!content) return res.status(400).json({error:"Bình luận không được trống."});
  const p=db.prepare("SELECT id FROM posts WHERE id=?").get(req.params.id);
  if(!p) return res.status(404).json({error:"Bài viết không tồn tại."});
  const r=db.prepare("INSERT INTO comments(post_id,user_id,content) VALUES(?,?,?)").run(req.params.id,req.currentUser.id,content);
  res.json({ok:true,id:r.lastInsertRowid});
});
app.delete("/api/comments/:id",requireAdmin,(req,res)=>{
  const r=db.prepare("DELETE FROM comments WHERE id=?").run(req.params.id);
  res.json({ok:r.changes>0});
});

app.get("/api/admin/users",requireAdmin,(req,res)=>{
  res.json(db.prepare("SELECT id,username,role,approved,created_at FROM users ORDER BY approved ASC,id DESC").all());
});
app.post("/api/admin/users/:id/approve",requireAdmin,(req,res)=>{
  const r=db.prepare("UPDATE users SET approved=1 WHERE id=?").run(req.params.id);
  res.json({ok:r.changes>0});
});
app.post("/api/admin/users/:id/reject",requireAdmin,(req,res)=>{
  if(Number(req.params.id)===req.currentUser.id) return res.status(400).json({error:"Không thể tự xóa tài khoản quản trị."});
  const r=db.prepare("DELETE FROM users WHERE id=? AND role!='admin'").run(req.params.id);
  res.json({ok:r.changes>0});
});

app.use((err,req,res,next)=>{
  console.error(err);
  res.status(400).json({error:err.message || "Có lỗi xảy ra."});
});
app.listen(PORT,()=>console.log(`Website đang chạy trên cổng ${PORT}`));
