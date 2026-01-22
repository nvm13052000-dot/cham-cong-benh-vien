# Hướng Dẫn Đưa Website Lên GitHub Pages

Để chạy website chấm công này trên mạng, bạn cần đưa nó lên GitHub. Dưới đây là cách thực hiện đơn giản nhất.

## 1. Chuẩn Bị
Đảm bảo bạn đã cài **Git**. Kiểm tra bằng cách:
1.  Bấm phím `Windows` -> Gõ `cmd` -> Enter.
2.  Gõ `git --version` và Enter.
3.  Nếu hiện phiên bản (ví dụ `git version 2.x`), bạn đã sẵn sàng. Nếu báo lỗi, hãy tải Git tại [git-scm.com](https://git-scm.com/downloads) và cài đặt.

## 2. Tạo Kho Chứa (Repository) trên GitHub
1.  Đăng nhập [GitHub.com](https://github.com/).
2.  Bấm dấu `+` (góc trên phải) -> **New repository**.
3.  Ô "Repository name": Gõ `cham-cong-benh-vien`.
4.  Chọn **Public**.
5.  Cuộn xuống và bấm **Create repository**.
6.  **Giữ nguyên màn hình đó**, chúng ta sẽ cần dòng lệnh trong khung "…or create a new repository on the command line".

## 3. Upload Code (Cách Đơn Giản Cho Người Không Chuyên)
Bạn đang gặp khó khăn ở bước dòng lệnh? Hãy làm như sau:

**Cách 1: Dùng Giao diện GitHub (Dễ nhất, ko cần dòng lệnh)**
1.  Tại trang Repository vừa tạo trên GitHub, tìm dòng chữ nhỏ `uploading an existing file` và bấm vào đó.
2.  Mở thư mục `hospital-attendance` trên máy tính của bạn.
3.  Kéo thả TẤT CẢ các file (`index.html`, `styles.css`, `app.js`,...) vào trình duyệt.
4.  Đợi upload xong, ô "Commit changes" bên dưới, bấm nút xanh **Commit changes**.

**Cách 2: Dùng Dòng Lệnh (Nếu tích hợp sẵn)**
1.  Vào thư mục `hospital-attendance` trên máy tính.
2.  Nhấp chuột phải vào khoảng trống -> Chọn **Open in Terminal** (hoặc Open PowerShell window here, hoặc Git Bash here).
3.  Copy và chạy lần lượt từng dòng sau (Enter sau mỗi dòng):

```bash
git init
git add .
git commit -m "Upload code lan dau"
git branch -M main
```

4.  Quay lại trang GitHub, copy dòng lệnh bắt đầu bằng `git remote add origin...` và dán vào cửa sổ dòng lệnh -> Enter.
5.  Gõ `git push -u origin main` -> Enter.

## 4. Kích Hoạt Trang Web
1.  Tại trang GitHub của bạn, vào **Settings** (tab trên cùng).
2.  Menu bên trái, tìm và chọn **Pages**.
3.  Mục **Branch**, chọn `main` / `(root)`.
4.  Bấm **Save**.
5.  Đợi 1-2 phút, link website sẽ hiện ra ở trên cùng (dạng `username.github.io/...`).

Chúc bạn thành công!
