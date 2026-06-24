# **TÀI LIỆU ĐẶC TẢ LOGIC VÀ HÀNH VI HỆ THỐNG (SYSTEM BEHAVIOR SPECIFICATION)**

## **DỰ ÁN: SỐ HÓA BOARDGAME "AGILE THỰC CHIẾN"**

*Phiên bản: 1.2 — Trạng thái: Sẵn sàng lập trình*

## **1\. THIẾT LẬP MẶC ĐỊNH (DEFAULT APP SETTINGS)**

Để đảm bảo trải nghiệm người dùng (UX) mượt mà và tránh tình trạng phòng chơi bị đóng băng khi có người chơi treo máy (AFK), hệ thống tự động áp dụng bộ cấu hình mặc định sau:

### **1.1. Hệ thống đếm ngược (System Timers)**

* **Thời gian xem bài ẩn:** 30 giây (Đếm ngược ngay sau khi hệ thống phân vai bí mật).  
* **Thời gian "Giờ tan ca đầu tiên" (Đêm đầu):** 20 giây (Xử lý luồng nhìn và chọn mục tiêu bí mật).  
* **Thời gian thảo luận Sprint Planning (Họp Kế Hoạch):** 180 giây (3 phút).  
* **Thời gian PO chọn nhân sự tham gia Sprint:** 45 giây. Nếu hết giờ, hệ thống tự động chọn ngẫu nhiên đủ số lượng người đi Sprint theo bảng cấu hình rồi đẩy thẳng sang giai đoạn Biểu quyết.  
* **Thời gian Biểu quyết duyệt nhóm (Thumbs Up/Down):** 30 giây. Nếu hết giờ người chơi chưa bấm, hệ thống tự động ghi nhận là **Từ chối (Thumbs Down)**.  
* **Thời gian Bỏ phiếu kín thực thi dự án (Success/Fail):** 30 giây. Nếu hết giờ người chơi chưa bấm, hệ thống tự động ghi nhận là **Hoàn thành (Success)**.  
* **Thời gian chờ kích hoạt kỹ năng hậu Sprint (QC, Data Analyst):** 20 giây. Quá thời gian này, các nút chức năng sẽ mờ đi và khóa lại.  
* **Thời gian thảo luận lật kèo cuối game (Ám sát):** 60 giây.

### **1.2. Thiết lập hiển thị & Quyền riêng tư (UI/UX Privacy)**

* **Ẩn danh hòm phiếu:** Khi lật phiếu kín ở Giai đoạn 3, hệ thống phải thực hiện hiệu ứng xáo trộn (Shuffle) hiển thị các lá phiếu trên màn hình chung, tuyệt đối không lật theo thứ tự người chơi bấm nút nhằm tránh suy luận thời gian.  
* **Kênh chat độc quyền:** Phe Phá Dự Án có 1 kênh chat ẩn (Text/Voice) được hệ thống bật tự động **xuyên suốt toàn bộ game** (Kể cả ban ngày). Phe Scrum Team không thể nhìn thấy hoặc nghe thấy kênh này.

## **2\. LUỒNG TƯƠNG TÁC CHÍNH (MAIN CORE FLOW)**

Hệ thống điều khiển trận đấu tự động luân chuyển qua các màn hình giao diện (Phase) theo sơ đồ sau:

\[Phát Bài Ẩn\] ➔ \[Giờ Tan Ca Đầu Tiên\] ➔ \[VÒNG LẶP SPRINT (Tối đa 4 vòng)\]  
                                                │  
                 ┌──────────────────────────────┴──────────────────────────────┐  
                 ▼                                                             ▼  
       \[Sprint Planning\] ➔ \[Majority Vote\] ➔ \[Thực Thi Sprint\]        \[Nghiệm Thu Cuối Game\]

### **2.1. Đêm đầu \- Giờ tan ca đầu tiên**

* Màn hình tất cả người chơi tối lại.  
* **Giao diện Scrum Master (SM):** Hiển thị danh sách phòng, gắn biểu tượng cảnh báo ⚠️ trên Avatar của Người trễ task.  
* **Giao diện Client:** Hiển thị duy nhất Avatar của nhân vật Business Analyst (BA) kèm dòng chữ: *"Nội gián: Đây chính là BA\!"*.  
* **Giao diện Thực tập sinh (TTS):** Ép buộc click chọn 1 người chơi trong phòng để "theo sát". Hệ thống khóa và ghi nhận ID mục tiêu này.

### **2.2. Vòng lặp các Sprint (Tối đa 4 Sprint)**

Mỗi Sprint bắt buộc phải trải qua 3 giai đoạn nhỏ:

#### **Giai đoạn 1: Sprint Planning**

* Hệ thống chuyển giao danh hiệu PO cho người kế tiếp theo chiều kim đồng hồ.  
* **Xử lý kỹ năng "Sếp khó ưa":** Sếp click chọn 1 người ➔ Hệ thống khóa chat/voice của người bị chọn trong suốt Sprint đó.  
* **Xử lý kỹ năng "Deadline":** Nếu nhân vật Deadline kích hoạt nút "Áp lực tối đa", hệ thống khóa chat/voice của **TẤT CẢ** thành viên trong phòng.  
* **Xử lý quyền lực của PM (Chiếm quyền chỉ định):** Nếu PM bấm nút kỹ năng, quyền chọn nhóm của PO bị tước. Nhóm do PM chọn sẽ **bỏ qua Giai đoạn 2 (Majority Vote)** và đi thẳng vào Giai đoạn 3 (Bỏ phiếu kín).

#### **Giai đoạn 2: Majority Vote (Biểu quyết công khai)**

* Hệ thống hiển thị Popup cho cả bàn chọn: 👍 (Đồng ý) hoặc 👎 (Từ chối).  
* **Logic ngầm Thực tập sinh:** Nếu người đang bấm vote là mục tiêu theo sát của TTS, hệ thống tự động nhân đôi giá trị phiếu vote của người này (Tính là 2 phiếu 👍 hoặc 2 phiếu 👎).  
* **Xử lý kết quả:** Nếu số phiếu 👎 $\\ge$ số phiếu 👍, hệ thống tăng thanh Hoãn Sprint thêm 1 nấc, đưa phòng chơi quay lại Giai đoạn 1 và đổi PO. Nếu nấc Hoãn chạm mức 4, dừng game và xử phe Xấu thắng.

#### **Giai đoạn 3: Thực thi Sprint (Bỏ phiếu kín)**

* Hệ thống mở Popup lựa chọn cho nhóm đi dự án: 🟢 **Hoàn thành** hoặc 🔴 **Không hoàn thành**.  
* **Ràng buộc hệ thống:** Khóa chết nút 🔴 đối với người thuộc phe tốt (ScrumTeam), chỉ mở cho phe phá hoại.

## **3\. QUY TẮC PHÂN ĐỊNH LOGIC (RULE ENGINE) & XỬ LÝ XUNG ĐỘT**

Để phần mềm tự động xử lý chính xác kết quả hòm phiếu, hệ thống chạy chuỗi quét điều kiện (Validation Rules) sau ngay khi kết thúc bỏ phiếu kín:

1. **Quét QC cẩu thả:** Nếu nhân vật này đi Sprint và chọn nút 🔴, hệ thống tự động ghi nhận lá phiếu đó bằng **2 phiếu Fail**.  
2. **Quét cấu hình sập dự án:** Hệ thống đối chiếu số lượng phiếu 🔴 với cấu hình phòng. (Phòng dưới 7 người cần 1 phiếu Fail để sập; phòng từ 7 người trở lên, riêng Sprint 3 cần tới 2 phiếu Fail mới sập).  
3. **Quét gánh team của Technical Leader (TL):** Nếu tổng số phiếu Fail ghi nhận được trong hòm phiếu **đúng bằng 1** và trong nhóm có mặt TL, hệ thống tự động đổi trạng thái Sprint thành **Thành công (Success)**. Nếu số phiếu Fail $\\ge 2$, nội tại của TL bị vô hiệu hóa.  
4. **Hiệu ứng Technical Debt:** Nếu nhân vật này có mặt trong nhóm đi Sprint, hệ thống bật cờ trạng thái ép buộc cấu hình nhân sự của Sprint tiếp theo phải tăng thêm \+1 người so với mặc định.

## **4\. BẢNG THAM CHIẾU CẤU HÌNH HỆ THỐNG ĐỂ SỐ HÓA**

Để hệ thống vận hành trơn tru mà không cần người quản trò tính toán, dưới đây là bảng ma trận dữ liệu mà hệ thống sẽ tự động áp dụng khi thiết lập phòng chơi theo số lượng người:

| Số người chơi trong phòng | Số nhân sự đi Sprint 1 | Số nhân sự đi Sprint 2 | Số nhân sự đi Sprint 3 | Số nhân sự đi Sprint 4 | Điều kiện sập tại Sprint 3 |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **5 người** | 2 | 3 | 2 | 3 | Chỉ cần 1 phiếu Fail |
| **6 người** | 2 | 3 | 4 | 3 | Chỉ cần 1 phiếu Fail |
| **7 người** | 2 | 3 | 3 | 4 | **Phải từ 2 phiếu Fail trở lên** |
| **8 người** | 3 | 4 | 4 | 5 | **Phải từ 2 phiếu Fail trở lên** |
| **9 người** | 3 | 4 | 4 | 5 | **Phải từ 2 phiếu Fail trở lên** |
| **10 người** | 3 | 4 | 5 | 6 | **Phải từ 2 phiếu Fail trở lên** |

📌 **Quy tắc hệ thống bổ sung:** Nếu ở Sprint liền trước có nhân vật *Technical Debt* tham gia, số lượng nhân sự tại cột tương ứng của Sprint tiếp theo sẽ được hệ thống tự động cộng thêm \+1 (Ví dụ: Phòng 5 người, Sprint 1 có Tech Debt suy ra Sprint 2 hệ thống sẽ bắt buộc PO phải chọn đủ 4 người thay vì 3).

Mỗi trận đấu gồm tối đa 4 Sprint. Mỗi Sprint bắt buộc phải trải qua tuần tự 3 giai đoạn được hệ thống kiểm soát bằng đồng hồ đếm ngược (Timer).

### **Giai đoạn 1: Sprint Planning (Họp Kế Hoạch)**

#### **1\. Hành vi Chỉ định Quản trò luân phiên (PO)**

* **Sprint 1:** Hệ thống chọn ngẫu nhiên một người (hoặc người chủ phòng) làm PO. Trên Avatar của người này sẽ xuất hiện Vương miện/Huy hiệu PO.  
* **Sprint 2, 3, 4:** Hệ thống tự động chuyển Huy hiệu PO sang người ngồi kế tiếp bên tay trái theo sơ đồ vòng tròn của phòng chơi.

#### **2\. Kiểm tra điều kiện Khống chế Thảo luận**

* **Hành vi của Ông sếp khó ưa:** Đầu giai đoạn, hệ thống mở một bảng chọn nhanh cho Sếp. Sếp click chọn 1 người $\\rightarrow$ Người bị chọn lập tức bị hệ thống khóa tính năng Chatbox, tắt Microphone và nút biểu tượng cảm xúc (Emoji) trong suốt thời gian thảo luận của Sprint đó.  
* **Hành vi của Deadline (Áp lực tối đa):** Nhân vật Deadline có một nút bấm "Kích hoạt áp lực" (Chỉ sáng lên 1 lần/game). Nếu Deadline bấm nút này, hệ thống lập tức khóa quyền thảo luận (Chat/Voice) của **TẤT CẢ** thành viên trong phòng, đưa phòng chơi vào trạng thái im lặng tuyệt đối.  
* **Đồng hồ đếm ngược thảo luận:** Hệ thống chạy đồng hồ từ 3 \- 5 phút để cả bàn tranh luận công khai.

#### **3\. Hành vi Đề xuất nhóm & Sự can thiệp của Project Manager (PM)**

* **Trường hợp thông thường:** PO đương nhiệm click chọn các thành viên vào nhóm đi Sprint dựa theo số lượng quy định của bảng cấu hình (Ví dụ: Phòng 5 người, Sprint 1 cần chọn đúng 2 người). Nút "Chốt danh sách" chỉ sáng lên khi chọn đủ số lượng.  
* **Trường hợp PM can thiệp (Mệnh lệnh của PM):** Trên màn hình của PM luôn có nút "Chiếm quyền chỉ định". Nếu PM bấm nút này trước khi PO chốt danh sách, hệ thống sẽ thông báo toàn phòng: *"PM đã can thiệp dự án\!"*, tước quyền của PO đương nhiệm và chuyển giao diện chọn nhóm cho PM. Nhóm do PM chọn sẽ được hệ thống chuyển **thẳng sang Giai đoạn 3 (Bỏ phiếu kín)**, bỏ qua hoàn toàn Giai đoạn 2 (Biểu quyết công khai).

### **Giai đoạn 2: Biểu quyết duyệt nhóm (Majority Vote)**

* Hệ thống bật một Popup lớn giữa màn hình của tất cả người chơi với hai lựa chọn rõ ràng: 👍 **Đồng ý duyệt nhóm** hoặc 👎 **Từ chối nhóm**. Thời gian lựa chọn là 30 giây.  
* **Hành vi ẩn xử lý phiếu của Thực tập sinh:**  
  * Hệ thống kiểm tra nếu hiện tại đang là từ Sprint 2 trở đi.  
  * Nếu người chơi đang bấm vote chính là "Người được chọn theo sát" của TTS, hệ thống sẽ tự động đếm phiếu của người này thành 2 phiếu (Dù trên giao diện người dùng chỉ hiển thị 1 lượt bấm).  
* **Hành vi xử lý kết quả biểu quyết từ Hệ thống:**  
  * **Kịch bản Thua/Hòa (Số phiếu 👎 $\\ge$ Số phiếu 👍):** Hệ thống bắn thông báo *"Nhóm bị bác bỏ\! Sprint bị hoãn"*. Thanh trạng thái "Hoãn Sprint" tăng thêm 1 nấc. Hệ thống tự động chuyển giao diện về lại Giai đoạn 1, luân phiên PO sang người bên trái. *Đặc biệt:* Nếu nấc Hoãn Sprint chạm mức 4, hệ thống lập tức dừng trận đấu và xử phe Xấu thắng cuộc.  
  * **Kịch bản Thắng (Số phiếu 👍 $\>$ Số phiếu 👎):** Hệ thống thông báo nhóm được thông qua và kéo các thành viên được chọn vào giao diện Giai đoạn 3\.

### **Giai đoạn 3: Thực thi Sprint (Bỏ phiếu kín)**

#### **1\. Hành vi bỏ phiếu của các thành viên trong nhóm**

Hệ thống hiển thị Popup bảo mật cho những người nằm trong danh sách đi Sprint. Popup gồm 2 nút: 🟢 **Hoàn thành** và 🔴 **Không hoàn thành**.

* **Hành vi khóa tính năng theo Phe:** Hệ thống kiểm tra vai trò. Nếu người chơi thuộc phe tốt (Scrum Team), hệ thống **khóa chết nút 🔴 (Không hoàn thành)**, buộc họ chỉ có thể bấm nút màu xanh. Chỉ phe Phá Dự Án mới có quyền chọn lựa giữa 2 nút.

#### **2\. Hành vi kiểm phiếu và áp dụng tính năng nhân vật từ Hệ thống**

Sau khi mọi người bấm xong, hệ thống tiến hành gom các lá phiếu, xáo trộn ngẫu nhiên để không ai biết phiếu của ai, sau đó thực hiện chuỗi logic kiểm tra sau:

* **Bước 1 \- Tính toán phiếu của QC cẩu thả:** Hệ thống kiểm tra xem trong nhóm đi Sprint có *QC cẩu thả* không. Nếu có và nhân vật này chọn nút 🔴, hệ thống tự động cộng thêm 2 phiếu Fail vào tổng số thay vì 1\.  
* **Bước 2 \- Kiểm tra điều kiện sập Sprint:** Hệ thống đối chiếu tổng số phiếu 🔴 với cấu hình phòng chơi. (Ví dụ: Phòng dưới 7 người cần 1 phiếu Fail để sập; phòng từ 7 người trở lên, Sprint 3 cần tới 2 phiếu Fail mới sập).  
* **Bước 3 \- Sự gánh team của Technical Leader (TL):** Nếu kết quả cuối cùng tính ra có **đúng 1 phiếu Fail** và trong nhóm đi Sprint có mặt *TL*, hệ thống kích hoạt hành vi tự sửa lỗi của TL $\\rightarrow$ Tự động chuyển phiếu Fail đó thành Success, cứu Sprint thành công.

#### **3\. Hành vi sau khi công bố kết quả & Kỹ năng Kích hoạt**

Hệ thống hiển thị kết quả Sprint lên màn hình chính (Ví dụ: "Sprint 1: THÀNH CÔNG" hoặc "Sprint 1: CHÁY DEADLINE"). Tại thời điểm này, hệ thống sẽ mở ra một cửa sổ thời gian chờ (15-30 giây) để ghi nhận các hành vi kích hoạt kỹ năng đặc biệt:

* **Hành vi kích hoạt của Quality Controller (QC \- Yêu cầu làm lại):** QC có một nút bấm "Hủy kết quả & Làm lại" (Chỉ dùng được 1 lần/game). Nếu QC bấm nút này, hệ thống sẽ xóa bỏ kết quả vừa tính, đưa trạng thái Sprint hiện tại về lại từ đầu Giai đoạn 1 (Lập kế hoạch lại cho chính Sprint đó).  
* **Hành vi tích lũy của Nợ kỹ thuật (Technical Debt):** Hệ thống kiểm tra xem trong nhóm vừa đi Sprint có *Tech Debt* không. Nếu có, hệ thống sẽ kích hoạt một biến cờ trạng thái ẩn: Bắt buộc ở cấu hình Sprint tiếp theo, số lượng nhân sự tham gia phải tự động cộng thêm \+1 người.

## **III. GIAI ĐOẠN NGHIỆM THU & PHÂN ĐỊNH THẮNG THUA (END GAME ENGINE)**

Hệ thống sẽ liên tục kiểm tra điều kiện kết thúc game sau mỗi Sprint:

* **Phe Phá Dự Án thắng ngay lập tức khi:** Tích lũy đủ 3 Sprint bị Cháy deadline HOẶC thanh Hoãn Sprint chạm mức 4\. Hệ thống dừng game và hiện màn hình ăn mừng của phe Xấu.  
* **Trường hợp Scrum Team tích lũy đủ 3 Sprint thành công:** Hệ thống chưa tuyên bố thắng cuộc ngay mà sẽ chuyển sang **Vòng lật kèo cuối game (Vòng Ám sát)**.

### **Luồng hành vi tại Vòng lật kèo cuối game:**

1. Hệ thống lật mở toàn bộ vai trò của phe Phá Dự Án để họ nhìn thấy nhau, mở một khung Chat độc quyền ngắn trong 1 phút để họ thảo luận.  
2. Màn hình của *Người trễ task* xuất hiện danh sách tất cả người chơi thuộc phe Scrum Team.  
3. *Người trễ task* phải click chỉ điểm 1 người mà họ nghi ngờ là Scrum Master (SM).  
4. **Xử lý kết quả từ Hệ thống:**  
   * Nếu chọn **ĐÚNG** người là Scrum Master: Phe Phá Dự Án lật kèo chiến thắng, dự án thất bại.  
   * Nếu chọn **SAI**: Phe Scrum Team chính thức giành chiến thắng chung cuộc, dự án được release thành công.

