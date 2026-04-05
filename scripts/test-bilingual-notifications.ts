import { getTranslation } from "../lib/notifications/i18n";
import { formatDateForDisplay } from "../lib/date-utils";

async function testTranslations() {
  console.log("=== Testing Bilingual Notification Templates ===\n");

  const mockParams = {
    name: "John Doe",
    destination: "ICT Department",
    approver: "Admin User",
    id: "APV-ABC-123",
    gate: "1",
    from: "2026-03-30",
    to: "2026-04-05",
    comment: "Approved for official visit."
  };

  const locales = ["en", "am"];

  for (const locale of locales) {
    console.log(`--- Locale: ${locale.toUpperCase()} ---`);
    
    // Test Request Approved
    const approvedSubject = getTranslation("notifications.request_approved.subject", locale, { id: mockParams.id });
    const approvedBody = getTranslation("notifications.request_approved.body", locale, mockParams);
    
    console.log(`[Request Approved]`);
    console.log(`Subject: ${approvedSubject}`);
    console.log(`Body: ${approvedBody}\n`);

    // Test Guest Check-in
    const checkinSubject = getTranslation("notifications.guest_checkin.subject", locale);
    const checkinBody = getTranslation("notifications.guest_checkin.body", locale, { 
      name: "Guest Name", 
      organization: "Guest Org", 
      gate: "2" 
    });

    console.log(`[Guest Check-in]`);
    console.log(`Subject: ${checkinSubject}`);
    console.log(`Body: ${checkinBody}\n`);
  }

  console.log("=== Test Complete ===");
}

testTranslations().catch(console.error);
