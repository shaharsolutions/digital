# הוראות התקנה ל-Google Apps Script

כדי לחבר את הטופס בדף הנחיתה ל-Google Sheets, עליך לבצע את השלבים הבאים:

1. פתח גיליון Google Sheets חדש (או קיים).
2. בתפריט העליון, לחץ על **הרחבות (Extensions)** > **Apps Script**.
3. מחק את כל הקוד הקיים בעורך הקוד, והדבק במקומו את הקוד הבא:

```javascript
function doPost(e) {
  // קבלת הגיליון הפעיל
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // אם הגיליון ריק, הוסף כותרות
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["זמן שליחה", "שם מלא", "טלפון", "אימייל", "שם העסק", "מה רוצים לשפר"]);
  }
  
  // קריאת הנתונים מהטופס
  var params = e.parameter;
  var fullName = params.fullName || "";
  var phone = params.phone || "";
  var email = params.email || "";
  var businessName = params.businessName || "";
  var improvement = params.improvement || "";
  
  // 1. ניקוי תגיות HTML לצורך כתיבה לגיליון (כדי שהטבלה תישאר נקייה ומסודרת)
  var cleanImprovementForSheet = improvement
    .replace(/<br\s*\/?>/gi, "\n")      // החלפת br במעבר שורה
    .replace(/<hr[^>]*>/gi, "\n---\n")  // החלפת hr בקו הפרדה פשוט
    .replace(/<[^>]*>/g, "");           // הסרת שאר התגיות (כמו <b>)
  
  // הוספת שורה חדשה עם הנתונים הנקיים לגיליון
  sheet.appendRow([
    new Date(),
    fullName,
    phone,
    email,
    businessName,
    cleanImprovementForSheet
  ]);
  
  // 2. שליחת מייל ליד מעוצב ומרהיב ישירות אליך לתיבת הדואר (HTML Email)
  try {
    var emailRecipient = "shaharsolutions@gmail.com";
    var emailSubject = "ליד חדש - " + fullName;
    
    // יצירת קישור וואטסאפ מהיר
    var whatsappLink = "https://wa.me/972" + phone.replace(/^0/, "");
    var sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
    
    var htmlBody = `
      <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; padding: 30px; border-radius: 16px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="background-color: #0f172a; padding: 20px; border-radius: 12px 12px 0 0; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">פרטי ליד חדש</h2>
        </div>
        <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #334155; width: 100px;">שם מלא:</td>
              <td style="padding: 10px 0; color: #0f172a;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #334155;">טלפון:</td>
              <td style="padding: 10px 0; color: #0f172a;">
                <a href="tel:${phone}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${phone}</a> | 
                <a href="${whatsappLink}" style="color: #10b981; text-decoration: none; font-weight: 600;" target="_blank">וואטסאפ</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #334155;">אימייל:</td>
              <td style="padding: 10px 0; color: #0f172a;">${email || "לא צוין"}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #334155;">שם העסק:</td>
              <td style="padding: 10px 0; color: #0f172a;">${businessName || "לא צוין"}</td>
            </tr>
          </table>
          
          <div style="margin-top: 20px; padding: 20px; background-color: #f8fafc; border-right: 4px solid #2563eb; border-radius: 8px; color: #334155; line-height: 1.6;">
            <h4 style="margin: 0 0 10px 0; color: #0f172a; font-weight: bold;">מה רוצים לשפר?</h4>
            <div style="font-size: 14px; color: #475569;">${improvement}</div>
          </div>
          
          <div style="text-align: center; margin-top: 35px;">
            <a href="${sheetUrl}" style="background-color: #cbd5e1; color: #0f172a; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 15px; border: 1px solid #cbd5e1;" target="_blank">לניהול הלידים בגיליון</a>
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px;">
          &copy; ${new Date().getFullYear()} שחר פתרונות דיגיטליים. כל הזכויות שמורות.
        </div>
      </div>
    `;
    
    MailApp.sendEmail({
      to: emailRecipient,
      subject: emailSubject,
      htmlBody: htmlBody
    });
  } catch(err) {
    Logger.log("Email error: " + err.message);
  }
  
  // החזרת תשובה לדפדפן (חובה)
  return ContentService.createTextOutput("Success");
}
```

4. **שמירה:** לחץ על אייקון הדיסקט או `Ctrl+S` וניתן שם לפרוייקט (למשל "Landing Page Handler").
5. **פריסה (Deploy):**
   - לחץ על הכפתור הכחול **Deploy** (פריסה) בצד ימין למעלה -> **New deployment**.
   - בתיבה שנפתחת, לחץ על גלגל השיניים (Select type) ובחר **Web app**.
   - מלא את השדות:
     - **Description:** תיאור קצר (לא חובה).
     - **Execute as:** `Me` (הכינוי שלך).
     - **Who has access:** (חשוב מאוד!) שנה ל-**Anyone** (כל אחד). אם זה לא יהיה על Anyone, הטופס לא יוכל לשלוח נתונים.
   - לחץ **Deploy**.
   - ייתכן שתתבקש לאשר הרשאות (Authorize access). אשר אותן (אם מופיעה אזהרה "Google hasn't verified this app", לחץ על `Advanced` ואז על `Go to... (unsafe)`).

6. **העתקת הקישור:**
   - לאחר הפריסה, תקבל כתובת URL (Web App URL).
   - העתק את הכתובת הזו.

7. **עדכון הדף:**
   - פתח את הקובץ `script.js` בתיקייה שנוצרה.
   - בשורה המציינת `const SCRIPT_URL = 'INSERT_YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';`
   - הדבק את הכתובת שהעתקת במקום הטקסט שבגרשיים.
   - שמור את הקובץ.

זהו! כעת כל פעם שמישהו ימלא את הטופס, הנתונים יופיעו בגיליון ושם העסק שהגדרת.
