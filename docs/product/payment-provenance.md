# Production payment details

The project owner confirmed manual Philippine Red Cross bank transfer as the
production MVP payment process in the latest task instruction. The application
fee is PHP 1,200. The account name is Philippine Red Cross. The four account
numbers are held exactly in `src/lib/payment/config.ts`: BPI `002963007828`,
BDO `004530012185`, Security Bank `0132062464003`, and Metrobank
`151-3-15114558-3`. All are PHP savings accounts. The app displays only these
bank choices and does not show a payment QR or use a payment gateway.

Payment declaration, private receipt-image upload, staff verification,
application approval, and PRC membership confirmation are separate decisions.
The old GCash image in `private-reference-assets/` is an ignored historical
reference file and is not part of the build or public site. The tracked public
payment QR asset was removed. Referral and confirmed-member QR codes are
unrelated to payment and remain in the product.

The source documents provided do not establish a replacement-proof or
incorrect-payment/refund policy. The application supports a reasoned request
for replacement while preserving proof versions. Do not publish new policy
wording without the approved source.
