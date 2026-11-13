# Live Google Sheets connection

Sheet owner: Nimish (nimish.dop@gmail.com). Automation account: sudarshanknowsmarketing@gmail.com, granted editor access to both sheets with the user’s authorization. Both spreadsheets remain private.

- Inventory: https://docs.google.com/spreadsheets/d/1ynXheNVynrehVnixiWyekhvU-8ylW5wMVSdMPnve_RM/edit
- Enquiries: https://docs.google.com/spreadsheets/d/1kudREmSJvLia0nzSOiiszgK1qNdKLcG8SePYTFbpnEs/edit

## Activation status

Activated on 2026-11-13. Apps Script project: `19-ry-rjLUbfMwrf333nDDSkIsuPn3a1tOYc0G26Rxt7uUGRiyq58OXxE`, deployed as Sudarshan with access set to Anyone; requests still require the server-held shared secret. Both production Vercel environment variables are configured. The sheets remain private.

Live verification: 70 inventory records loaded; a labelled test enquiry saved exactly once on retry; unit 101 status/price changed through the sheet, appeared through the bridge, then restored and rechecked. The local walkthrough is checked against the real bridge. Hosted browser verification remains subject to the saved website permission block. The temporary preview bypass is removed completely, including support for prior preview sessions. Test enquiries are labelled TEST ONLY and may be archived by the team.

## Recreate the connection if needed

1. Create a standalone Google Apps Script project named `Tourlo V2 Sheets Bridge` and paste `Code.gs` into its editor.
2. In Project Settings, add Script Properties:
   - `LEADS_SHEET_ID`: `1kudREmSJvLia0nzSOiiszgK1qNdKLcG8SePYTFbpnEs`
   - `INVENTORY_SHEET_ID`: `1ynXheNVynrehVnixiWyekhvU-8ylW5wMVSdMPnve_RM`
   - `TOURLO_SECRET`: a cryptographically random secret of at least 32 bytes. Keep this private.
3. Deploy a new **Web app**, executing as sudarshanknowsmarketing@gmail.com. The website server needs access to the web app endpoint without an interactive Google sign-in. The script itself requires the shared secret before reading or writing either private sheet. Review Google's requested account permissions before authorizing.
4. In the **new** Vercel project `tourlo-residences-v2`, set server environment variables `GOOGLE_SCRIPT_URL` to the deployed `/exec` URL and `GOOGLE_SCRIPT_SECRET` to the same secret. Apply them to the intended deployment environments and redeploy. Do not change the original project.
5. Submit a clearly labelled test enquiry from the deployed website. Verify exactly one row appears and the journey resumes. Retry that request ID and verify no duplicate row.
6. Record a test unit's current status and price. Temporarily change its status in the Inventory tab, verify the website reflects the change within 30 seconds while preserving the shortlist, then restore the original value. Verify the restored value too.

## Operating the sheets

Change only `status` and `price` in Inventory. Status must be `available`, `held`, or `sold`; price is a positive number in INR. Keep all 70 unit IDs and headers intact. Structural changes to apartment types, plans or unit IDs require updating the website's base inventory.

The website refreshes inventory every 30 seconds while visible and again after reconnecting. It retains the last successful snapshot if refresh fails. An unconfigured deployment is explicitly labelled sample availability. Invalid/incomplete sheets never partially replace the inventory.

Enquiries append only after authentication. `requestId` deduplication prevents duplicate rows when a response is lost and the visitor retries. Formula-like visitor values are escaped. Enquiry details are never returned by the public inventory endpoint or written to server logs. Do not rename the Enquiries tab or add notes below its data; put operational notes on a separate tab.

Apps Script is a modest-volume bridge. Before a large campaign, review Google execution quotas and add durable queuing/rate controls appropriate to expected traffic. This build does not claim unlimited throughput or guaranteed delivery during outages.
