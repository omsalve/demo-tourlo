# Live Google Sheets connection

Owner: Nimish (nimish.dop@gmail.com). Both spreadsheets are private.

- Inventory: https://docs.google.com/spreadsheets/d/1ynXheNVynrehVnixiWyekhvU-8ylW5wMVSdMPnve_RM/edit
- Enquiries: https://docs.google.com/spreadsheets/d/1kudREmSJvLia0nzSOiiszgK1qNdKLcG8SePYTFbpnEs/edit

## Activation status

The sheets and server code are prepared. The Apps Script web app has **not been deployed or connected** because the browser's saved access policy blocked script.google.com, and the app also denied access to its settings. No production enquiry write or live inventory read has been verified. Do not describe the integration as active yet.

## Activate as Nimish

1. Create a standalone Google Apps Script project named `Tourlo V2 Sheets Bridge` and paste `Code.gs` into its editor.
2. In Project Settings, add Script Properties:
   - `LEADS_SHEET_ID`: `1kudREmSJvLia0nzSOiiszgK1qNdKLcG8SePYTFbpnEs`
   - `INVENTORY_SHEET_ID`: `1ynXheNVynrehVnixiWyekhvU-8ylW5wMVSdMPnve_RM`
   - `TOURLO_SECRET`: a cryptographically random secret of at least 32 bytes. Keep this private.
3. Deploy a new **Web app**, executing as Nimish. The website server needs access to the web app endpoint without an interactive Google sign-in. The script itself requires the shared secret before reading or writing either private sheet. Review Google's requested account permissions before authorizing.
4. In the **new** Vercel project `tourlo-residences-v2`, set server environment variables `GOOGLE_SCRIPT_URL` to the deployed `/exec` URL and `GOOGLE_SCRIPT_SECRET` to the same secret. Apply them to the intended deployment environments and redeploy. Do not change the original project.
5. Submit a clearly labelled test enquiry from the deployed website. Verify exactly one row appears and the journey resumes. Retry that request ID and verify no duplicate row.
6. Record a test unit's current status and price. Temporarily change its status in the Inventory tab, verify the website reflects the change within 30 seconds while preserving the shortlist, then restore the original value. Verify the restored value too.

## Operating the sheets

Change only `status` and `price` in Inventory. Status must be `available`, `held`, or `sold`; price is a positive number in INR. Keep all 70 unit IDs and headers intact. Structural changes to apartment types, plans or unit IDs require updating the website's base inventory.

The website refreshes inventory every 30 seconds while visible and again after reconnecting. It retains the last successful snapshot if refresh fails. An unconfigured deployment is explicitly labelled sample availability. Invalid/incomplete sheets never partially replace the inventory.

Enquiries append only after authentication. `requestId` deduplication prevents duplicate rows when a response is lost and the visitor retries. Formula-like visitor values are escaped. Enquiry details are never returned by the public inventory endpoint or written to server logs. Do not rename the Enquiries tab or add notes below its data; put operational notes on a separate tab.

Apps Script is a modest-volume bridge. Before a large campaign, review Google execution quotas and add durable queuing/rate controls appropriate to expected traffic. This build does not claim unlimited throughput or guaranteed delivery during outages.
