export const LEGAL_OPERATOR = Object.freeze({
  englishName: "Hangzhou Didren Technology Co., Ltd.",
  chineseName: "杭州地底人科技有限公司",
  supportEmail: "support@didren.com",
  productName: "musuw"
});

export const PUBLIC_DOCUMENT_PATHS = Object.freeze([
  "/terms",
  "/privacy",
  "/refund-policy",
  "/subscription-policy",
  "/acceptable-use",
  "/cookies",
  "/security",
  "/contact"
]);

const updated = "2026-08-22";
const operator = `${LEGAL_OPERATOR.englishName}（${LEGAL_OPERATOR.chineseName}）`;

const p = (text) => ({ type: "paragraph", text });
const list = (...items) => ({ type: "list", items });
const note = (text) => ({ type: "notice", text });
const contact = (label = LEGAL_OPERATOR.supportEmail) => ({
  type: "email",
  label,
  address: LEGAL_OPERATOR.supportEmail
});
const link = (label, href) => ({ type: "link", label, href });

const englishDocuments = {
  "/terms": {
    path: "/terms",
    eyebrow: "Legal",
    title: "Terms of Service",
    summary:
      "These terms govern access to musuw, purchases, subscriptions, user content, and use of the product's source-grounded AI features.",
    updated,
    sections: [
      {
        heading: "1. Who operates musuw",
        blocks: [
          p(`${LEGAL_OPERATOR.productName} is provided by ${operator}, referred to as “we”, “us”, or the “Operator” in these terms.`),
          p(`Questions about the service or these terms can be sent to ${LEGAL_OPERATOR.supportEmail}. We aim to respond to support requests within three business days.`),
          contact()
        ]
      },
      {
        heading: "2. Acceptance and eligibility",
        blocks: [
          p("By creating an account, using musuw, or completing a purchase, you agree to these terms and the policies linked from them. If you use musuw for an organization, you confirm that you have authority to bind that organization."),
          p("You must be legally able to enter into this agreement. musuw is not directed to children under 16, and a person under the age of legal majority may use it only with valid consent from a parent or guardian where permitted by law.")
        ]
      },
      {
        heading: "3. The service",
        blocks: [
          p("musuw is a knowledge workspace that preserves source materials, uploads and parses common formats, organizes connected Wiki pages with a graph view inside Wiki, and provides AI-assisted dialogue with exact evidence links, export, and deletion controls."),
          p("Features may evolve. We may improve, replace, or discontinue a feature when reasonably necessary for security, legal compliance, reliability, or product development. If a material change significantly reduces a paid feature, we will provide reasonable notice and any remedy required by law."),
          note("Available paid upgrades use Paddle's secure checkout. A URL or checkout return is not proof of payment; musuw grants a paid plan only after verifying Paddle's signed server notification.")
        ]
      },
      {
        heading: "4. Accounts and security",
        blocks: [
          list(
            "Provide accurate account and billing information and keep it current.",
            "Keep credentials confidential and use reasonable safeguards for your account.",
            "Notify us promptly if you suspect unauthorized access.",
            "Do not share an individual plan in a way that bypasses plan limits or access controls."
          ),
          p("You are responsible for activity performed through your account unless the activity results from our failure to use reasonable security measures.")
        ]
      },
      {
        heading: "5. Your content and permissions",
        blocks: [
          p("You retain ownership of notes, documents, prompts, saved answers, and other material you submit to musuw. You grant us a limited, non-exclusive license to host, copy, process, transmit, and display that content only as needed to provide, secure, support, and improve the service for you, or as required by law."),
          p("You confirm that you have the rights and permissions needed to upload and process your content. You must not upload content that unlawfully infringes intellectual property, privacy, confidentiality, or other rights."),
          p("You can request export or deletion through the product controls when available or by contacting support. Deletion is subject to legal retention, security logs, dispute records, and normal backup rotation as explained in the Privacy Policy.")
        ]
      },
      {
        heading: "6. AI output and evidence",
        blocks: [
          p("AI output can be incomplete, inaccurate, or unsuitable for your circumstances. Evidence links and uncertainty indicators help you inspect an answer, but they do not make the output infallible."),
          p("You are responsible for reviewing important output before relying on it, publishing it, or using it to make decisions. musuw is not a substitute for legal, medical, financial, safety, or other regulated professional advice."),
          p("Do not use musuw to make solely automated decisions that produce legal or similarly significant effects on another person unless you independently satisfy all applicable notice, fairness, review, and legal requirements.")
        ]
      },
      {
        heading: "7. Plans, prices, and taxes",
        blocks: [
          p("The plan name, billing interval, price, included features, renewal status, and available payment methods are shown before checkout. Prices are shown in the stated currency. Applicable taxes, exchange effects, or payment-provider charges may be calculated or disclosed at checkout."),
          p("A recurring plan renews automatically until canceled. A one-time purchase does not renew. Details are in the Subscription and Cancellation Policy."),
          link("Read the Subscription and Cancellation Policy", "/subscription-policy")
        ]
      },
      {
        heading: "8. Seller and Merchant of Record",
        blocks: [
          p("Paddle acts as the authorized reseller and seller of record for musuw paid orders and handles the payment, applicable transaction taxes, receipt, and order-related buyer support under Paddle's buyer terms."),
          p("These provider terms apply to the purchase transaction. These musuw Terms govern your use of the product. If a mandatory consumer rule provides greater protection, that rule prevails.")
        ]
      },
      {
        heading: "9. Cancellation and refunds",
        blocks: [
          p("You can cancel a recurring plan through the management link in your receipt, the applicable payment provider's customer portal, an in-product billing link when available, or by contacting us. Cancellation stops future renewals and normally takes effect at the end of the paid period."),
          p("We offer the refund terms stated in the Refund Policy, including a 30-calendar-day request window for an initial paid order and the most recent renewal, subject to fraud and abuse safeguards and mandatory law."),
          link("Read the Refund Policy", "/refund-policy")
        ]
      },
      {
        heading: "10. Acceptable use",
        blocks: [
          p("You must comply with the Acceptable Use Policy. Prohibited conduct includes unlawful activity, abuse of others, rights infringement, credential theft, malicious code, unauthorized security testing, deceptive content, payment abuse, and attempts to bypass service limits."),
          link("Read the Acceptable Use Policy", "/acceptable-use")
        ]
      },
      {
        heading: "11. Our intellectual property",
        blocks: [
          p("musuw, its software, interfaces, branding, documentation, and service-generated materials other than your content are owned by us or our licensors. These terms give you a limited, revocable, non-transferable right to use the service according to your plan. They do not transfer ownership of our intellectual property."),
          p("Feedback is voluntary. If you provide feedback, you allow us to use it without restriction or payment, but we will not identify you publicly without permission.")
        ]
      },
      {
        heading: "12. Suspension and termination",
        blocks: [
          p("You may stop using musuw at any time. We may restrict or suspend access when reasonably necessary to prevent harm, investigate a credible violation, comply with law, address nonpayment, or protect the service and its users."),
          p("Where practical and lawful, we will provide notice and an opportunity to cure. We may terminate immediately for serious abuse, fraud, security attacks, or unlawful conduct. On termination, provisions that by their nature should survive will remain effective, including payment obligations, intellectual property, disclaimers, liability limits, and dispute terms.")
        ]
      },
      {
        heading: "13. Warranties and liability",
        blocks: [
          p("We provide the service with reasonable care and skill. Except for warranties that cannot lawfully be excluded, musuw is provided on an “as available” basis and we do not promise uninterrupted operation or error-free AI output."),
          p("To the maximum extent permitted by law, neither party is liable for indirect, incidental, special, punitive, or consequential loss, or loss of profits, revenue, goodwill, or data, that was not reasonably foreseeable."),
          p("To the maximum extent permitted by law, our aggregate liability arising from the service is limited to the greater of USD 100 or the amount you paid for musuw during the 12 months before the event giving rise to the claim. This limit does not apply where liability cannot legally be limited, including fraud, willful misconduct, death or personal injury caused by negligence, or mandatory consumer rights.")
        ]
      },
      {
        heading: "14. Governing law and disputes",
        blocks: [
          p("These terms are governed by the laws of the People's Republic of China, without regard to conflict-of-law rules. Courts with jurisdiction at the Operator's domicile will have jurisdiction, unless mandatory law gives you the right to bring a claim elsewhere."),
          p(`Before filing a formal claim, please contact ${LEGAL_OPERATOR.supportEmail} so we can try to resolve the matter. Nothing in these terms restricts non-waivable consumer rights or your right to contact a regulator or consumer-protection authority.`)
        ]
      },
      {
        heading: "15. Changes and contact",
        blocks: [
          p("We may update these terms to reflect product, legal, security, or operational changes. We will post the effective date and provide additional notice for material changes when required. Continued use after the effective date means the updated terms apply, except where affirmative consent is legally required."),
          contact()
        ]
      }
    ]
  },
  "/privacy": {
    path: "/privacy",
    eyebrow: "Privacy",
    title: "Privacy Policy",
    summary:
      "This policy explains what personal data musuw collects, why it is used, how long it is kept, who may process it, and the choices available to you.",
    updated,
    sections: [
      {
        heading: "1. Controller and scope",
        blocks: [
          p(`${operator} is the controller of personal data processed to operate musuw, except where another party is identified as an independent controller. This policy covers the public website, accounts, product features, support, and related communications.`),
          p(`Privacy questions and rights requests can be sent to ${LEGAL_OPERATOR.supportEmail}.`),
          contact()
        ]
      },
      {
        heading: "2. Data we collect",
        blocks: [
          list(
            "Account and contact data, such as name, email address, account identifiers, language, and workspace membership.",
            "Knowledge content, such as documents, notes, prompts, saved answers, citations, topics, Wiki pages, graph links, and files you choose to upload.",
            "Usage and technical data, such as feature events, aggregate page-performance metrics, IP address, device and browser information, locale, timestamps, diagnostics, security events, and cookie or local-storage identifiers where used.",
            "Support and communication data, including messages, attachments, feedback, and records needed to resolve a request.",
            "Transaction data, such as plan, amount, currency, billing interval, transaction identifier, payment status, tax location, and limited receipt information received from the payment provider. We do not receive or store your full card number."
          )
        ]
      },
      {
        heading: "3. Sources of data",
        blocks: [
          p("We collect data directly from you, automatically from your device when you use the service, from workspace administrators who invite you, from integrations you authorize, and from payment, fraud-prevention, support, or infrastructure providers involved in delivering the service."),
          p("Cloudflare may provide a country code for storefront language selection. We use that code to select Chinese for visitors in mainland China and English elsewhere; we do not use it to infer a precise location."),
          p("Cloudflare processes request metadata at the public edge for delivery, TLS, abuse prevention, and country-level language selection. The current storefront does not load an analytics or advertising beacon.")
        ]
      },
      {
        heading: "4. Purposes and legal bases",
        blocks: [
          list(
            "Provide the service and requested features, under our contract with you.",
            "Process accounts, purchases, subscriptions, support, and product communications, under the contract and our legitimate interests in operating the service.",
            "Secure, troubleshoot, prevent fraud and abuse, enforce policies, and maintain auditability, based on legitimate interests and legal obligations.",
            "Comply with tax, accounting, sanctions, law-enforcement, and other legal requirements.",
            "Improve usability and reliability using aggregated, de-identified, or limited service data, based on legitimate interests where permitted.",
            "Send optional marketing only with consent where consent is required. You can unsubscribe at any time."
          ),
          p("Where we rely on consent, you may withdraw it at any time without affecting processing that was lawful before withdrawal. Where we rely on legitimate interests, you may object as described below.")
        ]
      },
      {
        heading: "5. Knowledge content and AI processing",
        blocks: [
          p("musuw processes the source scope and prompts you select to retrieve evidence and generate requested output. For a requested AI feature, the minimum relevant prompts, retrieved excerpts, images, audio, or video may be sent through OpenRouter to the model and inference provider identified by the selected model. Embedding and reranking send the text needed to index or rank your sources."),
          p("OpenRouter states that it does not use API inputs or outputs for model training. A downstream model or inference provider may have different retention or training practices. The product identifies the selected model; review OpenRouter's current provider information before sending sensitive content and contact us if you need help identifying the route used for a request."),
          p("We do not sell private workspace content or use it for cross-context behavioral advertising. We do not make solely automated decisions about you that produce legal or similarly significant effects."),
          p("Avoid uploading unnecessary sensitive personal data. If you use musuw to process data about another person, you are responsible for having an appropriate legal basis, giving required notices, and respecting that person's rights.")
        ]
      },
      {
        heading: "6. Service providers and recipients",
        blocks: [
          p("We disclose personal data only as reasonably needed for the roles below. The current principal service providers and independent recipients are:"),
          list(
            "Supabase, Inc. provides identity and one-time-code services and processes account email, profile claims, identity identifiers, and login/session data for that role.",
            "Resend, Inc. delivers transactional authentication email and processes the recipient address, authentication-message content and metadata, and delivery and security events for that role.",
            "Google LLC processes Google-account data when you choose Google sign-in. musuw requests only the openid, profile, and email scopes and receives the identifiers and profile fields that Google returns for them.",
            "Cloudflare, Inc. provides DNS and edge delivery, transport security, abuse prevention, country-level language selection, and R2 object storage. It may process IP and request metadata, security signals, and uploaded source objects for those roles.",
            "OpenRouter, Inc. routes prompts, relevant source excerpts, media, model requests, usage, and a scoped user-tracking identifier to the selected model and inference provider. The model catalog currently includes models developed by DeepSeek, Alibaba Cloud's Qwen, OpenAI, Google, Anthropic, and Cohere; routing providers and their practices can vary by model.",
            "Langfuse GmbH provides production AI observability and debugging in its Japan Cloud region. Bounded traces may include prompts or queries, retrieved or source previews, model responses, model and tool identifiers, usage, latency, and error metadata needed to operate and troubleshoot requested AI features.",
            "Paddle entities act as the authorized reseller and Merchant of Record for paid musuw orders and process buyer contact, transaction, tax-location, payment, receipt, fraud-prevention, subscription, cancellation, and refund data under Paddle's buyer and privacy terms.",
            "Professional advisers, auditors, regulators, courts, and authorities when legally required or reasonably necessary to protect rights and safety.",
            "A successor in a merger, financing, reorganization, or sale, subject to appropriate confidentiality and notice requirements."
          ),
          p("We do not sell personal information for money. We do not share personal information for cross-context behavioral advertising."),
          link("Supabase Privacy Policy", "https://supabase.com/privacy"),
          link("Resend Privacy Policy", "https://resend.com/legal/privacy-policy"),
          link("Google Privacy Policy", "https://policies.google.com/privacy"),
          link("Cloudflare Privacy Policy", "https://www.cloudflare.com/privacypolicy/"),
          link("OpenRouter Privacy Policy", "https://openrouter.ai/privacy"),
          link("Langfuse Privacy Policy", "https://langfuse.com/privacy"),
          link("Langfuse Data Regions", "https://langfuse.com/security/data-regions"),
          link("Paddle Privacy Notice", "https://www.paddle.com/legal/privacy")
        ]
      },
      {
        heading: "7. International transfers",
        blocks: [
          p("musuw and its providers may process data outside the country where you live. When law requires safeguards for an international transfer, we use an approved transfer mechanism, contractual safeguards, consent where appropriate, or another lawful basis, and apply supplementary technical or organizational measures when needed."),
          p("You may contact us for information about safeguards relevant to your data, subject to legitimate confidentiality restrictions.")
        ]
      },
      {
        heading: "8. Retention",
        blocks: [
          p("We retain account and knowledge content while your account is active or as needed to provide the service. After a verified deletion request or account closure, we delete or de-identify content from active systems without undue delay, subject to lawful retention, security investigations, disputes, and normal backup rotation."),
          p("Transaction, tax, accounting, fraud-prevention, and legal records are retained for the periods required or permitted by applicable law. Security logs and support records are retained only as long as reasonably needed for their purpose."),
          p("When data is no longer needed, we delete, de-identify, or securely isolate it. De-identified information may be retained where it cannot reasonably be linked back to you.")
        ]
      },
      {
        heading: "9. Your privacy rights",
        blocks: [
          p("Depending on where you live, you may have rights to be informed, access data, correct inaccurate data, delete data, restrict or object to processing, obtain portable data, withdraw consent, and appeal or complain to a data-protection authority."),
          p("Residents of California may also have rights to know, delete, correct, limit use of sensitive information where applicable, opt out of sale or sharing, and receive equal service. musuw does not sell or share personal information for cross-context behavioral advertising."),
          p(`To exercise a right, withdraw consent, or close your account, email ${LEGAL_OPERATOR.supportEmail} from the account address with “Privacy request” or “Account deletion” in the subject. You may delete individual documents and knowledge bases with the product controls. We may request proportionate verification and may decline or limit a request only where law permits. Authorized agents must provide valid authority.`),
          p("We will respond within the period required by applicable law. You may appeal a denied request by replying with “Privacy appeal” in the subject line. You may also complain to your local supervisory or consumer-protection authority.")
        ]
      },
      {
        heading: "10. Security",
        blocks: [
          p("We use technical and organizational safeguards designed to protect personal data, including scoped access, server-side handling of service credentials, transport encryption, logging, exact evidence links, and data lifecycle controls where supported."),
          p("No system is completely secure. Protect your Google account and email inbox with multi-factor authentication and current recovery channels, protect your device, and report suspected unauthorized access promptly."),
          link("Read our Security Overview", "/security")
        ]
      },
      {
        heading: "11. Cookies and similar technology",
        blocks: [
          p("The current public storefront does not load analytics or advertising tracking. Cloudflare processes edge request and security metadata as described above. We do not use advertising cookies or cross-site behavioral tracking. Essential browser storage is used for language, authentication, security, and checkout-return state. External identity and checkout providers may use their own necessary technology under their notices."),
          link("Read the Cookie Notice", "/cookies")
        ]
      },
      {
        heading: "12. Children",
        blocks: [
          p("musuw is not directed to children under 16 and we do not knowingly collect their personal data. If you believe a child submitted personal data without valid authorization, contact us so we can investigate and delete it where required.")
        ]
      },
      {
        heading: "13. Changes and contact",
        blocks: [
          p("We may update this policy when our product, providers, or legal obligations change. We will post the new effective date and give additional notice when required for a material change."),
          contact()
        ]
      }
    ]
  },
  "/refund-policy": {
    path: "/refund-policy",
    eyebrow: "Purchases",
    title: "Refund Policy",
    summary:
      "musuw provides a clear 30-calendar-day refund request window for initial paid orders and the most recent subscription renewal, with mandatory consumer rights preserved.",
    updated,
    sections: [
      {
        heading: "1. Verified paid orders",
        blocks: [
          note("This policy applies to a completed Paddle transaction that musuw has received through a verified signed notification. A browser checkout return alone does not establish a paid order."),
          p("The Paddle receipt and musuw billing page identify the transaction and current billing status used for support and refund review.")
        ]
      },
      {
        heading: "2. Our 30-day promise",
        blocks: [
          p("You may request a full refund within 30 calendar days after an initial paid order or within 30 calendar days after the most recent subscription renewal."),
          p("The request window applies to monthly and annual renewals. A refund normally ends access associated with the refunded order. It does not automatically refund older billing periods outside the request window."),
          p("We may decline a discretionary refund where there is credible evidence of fraud, refund abuse, duplicate recovery, or an active chargeback. This exception never limits mandatory consumer rights.")
        ]
      },
      {
        heading: "3. How to request a refund",
        blocks: [
          list(
            "Use the refund or buyer-support link in your payment receipt.",
            "Use the applicable payment provider's customer or transaction portal.",
            `Email ${LEGAL_OPERATOR.supportEmail} with the account email, transaction identifier, purchase date, and a short description of the request.`
          ),
          p("We aim to acknowledge support requests within three business days. Do not send full card numbers, passwords, government identifiers, or other unnecessary sensitive information."),
          contact()
        ]
      },
      {
        heading: "4. Who processes the refund",
        blocks: [
          p("Paddle processes the refund to the original payment method where possible. Follow the Paddle receipt, Customer Portal, or buyer-support process."),
          p("We will cooperate with the Merchant of Record and honor our published 30-day promise, but transaction verification, payment-network timing, currency conversion, and provider buyer terms may affect how the refund appears.")
        ]
      },
      {
        heading: "5. Timing and access",
        blocks: [
          p("Approved refunds are submitted to the original payment method where possible, normally within 14 days after approval. Your bank or payment network may need additional time to display the credit."),
          p("When a full refund is issued, access to the refunded paid entitlement may end immediately. Before requesting deletion, export any material you are entitled to keep.")
        ]
      },
      {
        heading: "6. Defects, misdescription, and mandatory rights",
        blocks: [
          p("If musuw is materially defective, not as described, or not supplied with legally required care, contact us even if 30 calendar days have passed. Remedies required by applicable law remain available."),
          p("Nothing in this policy excludes or limits mandatory consumer rights, statutory withdrawal rights, or a payment provider's buyer protections. Where different terms apply, the highest non-waivable level of protection controls.")
        ]
      },
      {
        heading: "7. Cancellations are separate",
        blocks: [
          p("Canceling a subscription stops future renewals but does not by itself refund an existing charge. Request a refund separately under this policy."),
          link("Read the Subscription and Cancellation Policy", "/subscription-policy")
        ]
      }
    ]
  },
  "/subscription-policy": {
    path: "/subscription-policy",
    eyebrow: "Billing",
    title: "Subscription and Cancellation Policy",
    summary:
      "This policy explains automatic renewal, billing intervals, cancellation methods, plan changes, and the difference between subscriptions and one-time purchases.",
    updated,
    sections: [
      {
        heading: "1. What you buy",
        blocks: [
          p("Before checkout, musuw shows whether an offer is a recurring subscription or a one-time purchase, the plan, price, currency, billing interval, and included features."),
          p("A one-time purchase does not automatically renew. A recurring subscription automatically renews at the selected monthly or annual interval until canceled.")
        ]
      },
      {
        heading: "2. Charges and taxes",
        blocks: [
          p("For a recurring plan, the Merchant of Record charges the payment method on file at the start of each new billing period. Applicable taxes and any supported local-currency amount are calculated or disclosed at checkout."),
          p("If a charge fails, the payment provider may retry it and may notify you. Access may be limited after reasonable notice if payment remains overdue.")
        ]
      },
      {
        heading: "3. How to cancel",
        blocks: [
          list(
            "Open the manage-subscription link in your receipt.",
            "Use the Paddle Customer Portal for the order.",
            "Use an in-product billing link when production account billing is available.",
            `Email ${LEGAL_OPERATOR.supportEmail} from your account email and include the transaction identifier.`
          ),
          p("We aim to respond within three business days. To avoid the next charge, submit the cancellation before the renewal date and allow enough time for identity and transaction verification."),
          contact()
        ]
      },
      {
        heading: "4. Effect of cancellation",
        blocks: [
          p("Cancellation stops future automatic renewals. Unless a refund or mandatory law provides otherwise, paid access continues until the end of the current billing period and no further subscription charge is made."),
          p("Deleting the application, not using the service, or removing a payment app does not necessarily cancel a subscription. Use one of the cancellation methods above.")
        ]
      },
      {
        heading: "5. Plan and price changes",
        blocks: [
          p("An upgrade may take effect immediately and may create a prorated charge or credit disclosed before confirmation. A downgrade normally takes effect at the next renewal unless stated otherwise."),
          p("We will give at least 30 calendar days' notice before a material price increase for an existing subscription, unless a shorter period is required by tax or law. You may cancel before the new price takes effect.")
        ]
      },
      {
        heading: "6. Renewal notices and receipts",
        blocks: [
          p("The Merchant of Record sends a receipt for each paid order. Renewal reminders are sent where required by law or supported by the provider. You are responsible for keeping the account and receipt email current.")
        ]
      },
      {
        heading: "7. Refunds and mandatory rights",
        blocks: [
          p("Cancellation and refunds are different. A cancellation prevents future renewals. A refund reverses an eligible completed transaction. Our 30-calendar-day refund request window covers the most recent renewal."),
          link("Read the Refund Policy", "/refund-policy"),
          p("Nothing in this policy limits mandatory consumer rights.")
        ]
      }
    ]
  },
  "/acceptable-use": {
    path: "/acceptable-use",
    eyebrow: "Trust",
    title: "Acceptable Use Policy",
    summary:
      "This policy protects musuw users, infrastructure, and third parties by defining prohibited content, conduct, automated use, and security abuse.",
    updated,
    sections: [
      {
        heading: "1. General rule",
        blocks: [
          p("Use musuw lawfully, responsibly, and only with content and systems you are authorized to access. You are responsible for your content, prompts, configured integrations, and use of output.")
        ]
      },
      {
        heading: "2. Illegal and harmful activity",
        blocks: [
          p("Do not use musuw to facilitate unlawful conduct, violence, exploitation, trafficking, terrorism, evasion of sanctions, regulated weapons, or instructions intended to cause physical or material harm."),
          p("Do not threaten, harass, stalk, discriminate against, exploit, or dox another person, or create or distribute non-consensual intimate content.")
        ]
      },
      {
        heading: "3. Rights and privacy",
        blocks: [
          p("Do not upload or process material that you lack the right to use. Do not infringe intellectual property, privacy, publicity, confidentiality, contractual, database, or other rights."),
          p("Do not collect credentials, sensitive data, or personal data deceptively, or use musuw for unlawful surveillance or identification.")
        ]
      },
      {
        heading: "4. Security and platform abuse",
        blocks: [
          list(
            "No malware, ransomware, destructive code, credential theft, phishing, or fraud.",
            "No unauthorized vulnerability scanning, penetration testing, access, interception, or disruption.",
            "No bypassing authentication, workspace isolation, quotas, payment controls, rate limits, or safety mechanisms.",
            "No scraping or automated traffic that materially degrades the service or violates published limits.",
            "No reverse engineering except to the limited extent a non-waivable law expressly permits it."
          )
        ]
      },
      {
        heading: "5. Deception and high-impact decisions",
        blocks: [
          p("Do not impersonate another person, fabricate provenance, misrepresent AI output as verified fact, or use the service for spam, scams, fake engagement, or payment abuse."),
          p("Do not rely on musuw as the sole basis for decisions about employment, credit, housing, education, insurance, healthcare, legal rights, or access to essential services unless you independently meet all applicable requirements for qualified human review, notice, fairness, explanation, and appeal.")
        ]
      },
      {
        heading: "6. Sensitive and regulated use",
        blocks: [
          p("musuw is a general knowledge tool, not a regulated professional service. You may not use it to provide unlawful medical, legal, financial, credit, gambling, or other regulated services, or to evade licensing and compliance obligations.")
        ]
      },
      {
        heading: "7. Enforcement",
        blocks: [
          p("We may investigate credible reports and proportionately restrict content, integrations, or accounts to prevent harm. Serious or repeated violations may lead to suspension or termination. We may preserve and disclose information where law requires it."),
          p("Where appropriate, we will consider context, severity, recurrence, user intent, and available remediation. We may provide notice and an opportunity to appeal unless doing so would create risk or violate law.")
        ]
      },
      {
        heading: "8. Report abuse",
        blocks: [
          p(`Report suspected abuse to ${LEGAL_OPERATOR.supportEmail} with enough detail to locate the issue. Do not include unnecessary sensitive data.`),
          contact()
        ]
      }
    ]
  },
  "/cookies": {
    path: "/cookies",
    eyebrow: "Privacy",
    title: "Cookie Notice",
    summary:
      "This notice explains the limited browser storage used by the musuw storefront and product, including essential preferences, security, and external checkout technology.",
    updated,
    sections: [
      {
        heading: "1. Current storefront practice",
        blocks: [
          p("The current public musuw storefront does not load an analytics or advertising beacon. Cloudflare processes edge request and security metadata to deliver and protect the site, and supplies a country code used only for language selection."),
          p("The storefront does not set advertising cookies or use cross-site behavioral tracking. It stores the selected language in the essential musuw_locale cookie for up to one year and does not store a precise location."),
          p("If we introduce analytics that uses non-essential browser storage or advertising technology, we will update this notice and request consent where required.")
        ]
      },
      {
        heading: "2. Essential storage",
        blocks: [
          p("musuw may use cookies, local storage, or similar browser features that are necessary to keep you signed in, protect sessions, remember language or accessibility preferences, preserve checkout return state, prevent abuse, and provide requested features."),
          p("Essential storage cannot always be disabled through a consent control because the requested account or security function may not work without it. You can clear it using browser settings.")
        ]
      },
      {
        heading: "3. Payment-provider technology",
        blocks: [
          p("When you open Paddle Checkout, Paddle may use its own necessary cookies or similar technology for fraud prevention, payment processing, tax determination, localization, and buyer support. Paddle's notice applies on its domain.")
        ]
      },
      {
        heading: "4. Managing browser storage",
        blocks: [
          p("Most browsers let you inspect, block, or delete cookies and site data. Blocking essential storage may prevent sign-in, checkout, saved preferences, or other requested functions."),
          p("A browser's “Do Not Track” signal is not a uniform legal standard. We do not use the public storefront for cross-site behavioral advertising regardless of that signal.")
        ]
      },
      {
        heading: "5. Changes",
        blocks: [
          p("We will revise this notice if the categories, purposes, or providers of browser storage materially change. The effective date above identifies the current version.")
        ]
      },
      {
        heading: "6. Contact",
        blocks: [contact()]
      }
    ]
  },
  "/security": {
    path: "/security",
    eyebrow: "Trust",
    title: "Security Overview",
    summary:
      "musuw is designed around scoped knowledge access, preserved evidence, exact citations, server-side credentials, and visible data lifecycle controls.",
    updated,
    sections: [
      {
        heading: "1. Security approach",
        blocks: [
          p("We apply layered technical and organizational measures appropriate to the service and the sensitivity of knowledge content. Security is an ongoing risk-management process, not a guarantee that incidents can never occur."),
          p("The hosted product is delivered over HTTPS through scoped edge and server boundaries, and application releases use immutable image revisions. This page describes current product controls; it does not claim an external certification or independent assurance that has not been completed.")
        ]
      },
      {
        heading: "2. Workspace and retrieval scope",
        blocks: [
          p("Knowledge retrieval is bounded to the authenticated workspace and to the topics, sources, and versions authorized for a conversation. Access-control checks are applied at service boundaries rather than relying only on interface visibility."),
          p("Users should still avoid sharing accounts and should grant integrations only the permissions they need.")
        ]
      },
      {
        heading: "3. Credentials and transport",
        blocks: [
          p("Service credentials and model-provider keys are handled server-side and are not intentionally exposed to the browser. Production traffic is served over HTTPS, and sensitive secrets are separated from public frontend code."),
          p("Payment credentials are entered on the Merchant of Record's checkout. musuw does not receive or store full payment card numbers.")
        ]
      },
      {
        heading: "4. Evidence and source integrity",
        blocks: [
          p("musuw preserves raw source materials and version references so an answer can resolve the evidence used at the time. Uploaded material can be parsed into Wiki pages and a graph view inside Wiki while answers point back to exact evidence without rewriting prior source history."),
          p("These controls improve auditability but do not replace user review of important AI output.")
        ]
      },
      {
        heading: "5. Data lifecycle",
        blocks: [
          p("You can delete individual documents and knowledge bases through product controls. Where a data type has an export action, you can use it directly; for an account-wide copy or deletion request, contact support for verified coordination across identity, application, object-storage, and provider records. Legal retention, fraud-prevention, dispute records, security logs, and backup rotation may delay complete removal as described in the Privacy Policy."),
          link("Read the Privacy Policy", "/privacy")
        ]
      },
      {
        heading: "6. Operations and incident response",
        blocks: [
          p("We use logging, dependency review, access restriction, change verification, backups where appropriate, and incident procedures to detect, investigate, contain, and recover from security events."),
          p("If an incident is likely to create a material risk to affected people, we will provide notices required by applicable law and share practical protective steps.")
        ]
      },
      {
        heading: "7. Your responsibilities",
        blocks: [
          list(
            "Protect your Google account and email inbox with multi-factor authentication and keep their recovery channels current.",
            "Keep devices, browsers, and integrations updated.",
            "Use the narrowest appropriate knowledge and integration scope.",
            "Review important output and evidence before relying on it.",
            "Report suspected unauthorized access promptly."
          )
        ]
      },
      {
        heading: "8. Responsible disclosure",
        blocks: [
          p(`Send a suspected vulnerability to ${LEGAL_OPERATOR.supportEmail} with the subject “Security report”. Include reproducible details and avoid accessing, changing, or retaining data that is not yours.`),
          p("We do not currently operate a public bug-bounty program. Acknowledgment, eligibility, and any reward require a separate written agreement. Good-faith research must comply with law and the Acceptable Use Policy."),
          contact("Report a security issue")
        ]
      }
    ]
  },
  "/contact": {
    path: "/contact",
    eyebrow: "Support",
    title: "Contact musuw",
    summary:
      "Contact the musuw team for product help, billing and cancellation support, privacy requests, security reports, or merchant-review questions.",
    updated,
    sections: [
      {
        heading: "Operator",
        blocks: [
          p(`${LEGAL_OPERATOR.englishName}`),
          p(`${LEGAL_OPERATOR.chineseName}`),
          p("musuw is the product name used on this website.")
        ]
      },
      {
        heading: "Customer support",
        blocks: [
          p(`Email ${LEGAL_OPERATOR.supportEmail}. We aim to acknowledge customer-support requests within three business days.`),
          contact("Email customer support")
        ]
      },
      {
        heading: "Billing, refunds, and cancellation",
        blocks: [
          p("For the fastest transaction support, use the manage-order link in your Paddle receipt or Customer Portal. You can also email us with the account email and transaction identifier. Never send a full card number or password."),
          link("Refund Policy", "/refund-policy"),
          link("Subscription and Cancellation Policy", "/subscription-policy")
        ]
      },
      {
        heading: "Privacy and security",
        blocks: [
          p("Use the subject “Privacy request” to exercise a data right. Use “Security report” for a suspected vulnerability or unauthorized access. Include only the information needed to investigate."),
          link("Privacy Policy", "/privacy"),
          link("Security Overview", "/security")
        ]
      },
      {
        heading: "Merchant and review inquiries",
        blocks: [
          p("For Paddle, tax, domain-verification, or business-identification questions, include the relevant store, case, or transaction identifier. We do not publish private verification documents on this website."),
          contact("Email the operator")
        ]
      }
    ]
  }
};

const chineseDocuments = {
  "/terms": {
    path: "/terms",
    eyebrow: "法律条款",
    title: "服务条款",
    summary: "本条款适用于 musuw 的访问、购买、订阅、用户内容，以及具有来源依据和可核查证据的 AI 功能。",
    updated,
    sections: [
      {
        heading: "1. 运营主体",
        blocks: [
          p(`musuw 由 ${operator} 提供，本条款中的“我们”“本公司”或“运营方”均指该公司。`),
          p(`服务或条款问题可发送至 ${LEGAL_OPERATOR.supportEmail}。我们力争在 3 个工作日内回应支持请求。`),
          contact("联系支持")
        ]
      },
      {
        heading: "2. 接受条款与使用资格",
        blocks: [
          p("创建账户、使用 musuw 或完成购买，即表示您同意本条款及其中链接的政策。代表组织使用时，您确认有权使该组织受本条款约束。"),
          p("您必须具有订立本协议的法律能力。musuw 不面向 16 岁以下儿童；未达到法定成年年龄的人，仅可在法律允许且已取得父母或监护人有效同意时使用。")
        ]
      },
      {
        heading: "3. 服务内容与当前状态",
        blocks: [
          p("musuw 是知识工作空间，用于保留原始资料、上传并解析常见格式、组织相互连接的 Wiki 页面及其中的图谱视图，并通过精确证据链接、导出和删除控制提供 AI 辅助对话。"),
          p("功能会持续演进。为安全、合规、可靠性或产品发展之合理需要，我们可以改进、替换或停止某项功能。若重大变化显著减少已付费功能，我们将提供合理通知及法律要求的救济。"),
          note("可用付费升级使用 Paddle 安全结账。网址参数或结账返回不代表付款成功；仅在 musuw 服务器验证 Paddle 签名通知后，产品才授予付费方案。")
        ]
      },
      {
        heading: "4. 账户与安全",
        blocks: [
          list(
            "提供准确并保持最新的账户和账单信息。",
            "妥善保管凭据并为账户采取合理安全措施。",
            "发现疑似未授权访问时及时通知我们。",
            "不得通过共享个人套餐规避套餐限制或访问控制。"
          ),
          p("除因我们未采取合理安全措施导致的活动外，您应对通过本人账户进行的活动负责。")
        ]
      },
      {
        heading: "5. 您的内容与授权",
        blocks: [
          p("您保留对提交至 musuw 的笔记、文档、提示词、已保存答案及其他材料的所有权。您授予我们有限、非独占的许可，仅为向您提供、保护、支持和改进服务或履行法律义务之需要，对这些内容进行托管、复制、处理、传输和展示。"),
          p("您确认有权上传和处理相关内容。不得上传非法侵犯知识产权、隐私权、保密义务或其他权利的材料。"),
          p("功能可用时，您可通过产品控制申请导出或删除，也可联系支持。删除可能受法定留存、安全日志、争议记录和正常备份轮换限制，详见隐私政策。")
        ]
      },
      {
        heading: "6. AI 输出与证据",
        blocks: [
          p("AI 输出可能不完整、不准确或不适合您的具体情况。证据链接和不确定性提示可帮助核查，但不能保证输出绝对正确。"),
          p("在依赖、发布或用于决策前，您应审查重要输出。musuw 不能替代法律、医疗、财务、安全或其他受监管的专业意见。"),
          p("除非您已独立满足适用的告知、公平、人工复核和法律要求，否则不得仅依赖 musuw 对他人作出具有法律或类似重大影响的自动化决定。")
        ]
      },
      {
        heading: "7. 套餐、价格与税费",
        blocks: [
          p("结账前会显示套餐名称、计费周期、价格、所含功能、是否续费和可用付款方式。价格以页面标示币种为准；适用税费、汇率影响或支付服务商费用可能在结账时计算或披露。"),
          p("循环订阅会自动续费，直至取消；单次购买不会续费。详情见订阅与取消政策。"),
          link("查看订阅与取消政策", "/subscription-policy")
        ]
      },
      {
        heading: "8. 卖方与商户记录方",
        blocks: [
          p("Paddle 是 musuw 付费订单的授权经销商和记录卖方，根据其买家条款处理付款、适用交易税、收据和订单相关买家支持。"),
          p("付款服务商条款适用于购买交易，本 musuw 条款适用于产品使用。若强制性消费者规则提供更高保护，以该规则为准。")
        ]
      },
      {
        heading: "9. 取消与退款",
        blocks: [
          p("您可通过收据中的管理链接、适用付款服务商的客户门户、可用时的产品内账单入口或联系我们取消循环订阅。取消会停止未来续费，通常在已付费周期结束时生效。"),
          p("退款政策提供初次真实付款及最近一次续费后 30 个日历日的申请期限，同时适用反欺诈、反滥用措施和强制性法律。"),
          link("查看退款政策", "/refund-policy")
        ]
      },
      {
        heading: "10. 可接受使用",
        blocks: [
          p("您须遵守可接受使用政策。禁止行为包括违法活动、侵害他人、侵犯权利、窃取凭据、恶意代码、未经授权的安全测试、欺骗性内容、支付滥用和绕过服务限制。"),
          link("查看可接受使用政策", "/acceptable-use")
        ]
      },
      {
        heading: "11. 我们的知识产权",
        blocks: [
          p("除您的内容外，musuw 的软件、界面、品牌、文档及服务生成材料归我们或许可方所有。本条款仅根据套餐授予您有限、可撤销、不可转让的使用权，不转移我们的知识产权所有权。"),
          p("反馈完全自愿。提交反馈即允许我们不受限制且无需付费地使用，但未经许可我们不会公开识别您的身份。")
        ]
      },
      {
        heading: "12. 暂停与终止",
        blocks: [
          p("您可随时停止使用。为防止损害、调查可信违规、履行法律义务、处理未付款或保护服务和用户，我们可在合理必要范围内限制或暂停访问。"),
          p("在可行且合法时，我们会通知并提供纠正机会。严重滥用、欺诈、安全攻击或违法行为可导致立即终止。付款义务、知识产权、免责声明、责任限制和争议条款等按性质应继续有效的条款，在终止后仍有效。")
        ]
      },
      {
        heading: "13. 保证与责任",
        blocks: [
          p("我们以合理注意和技能提供服务。除法律不得排除的保证外，musuw 按“可用状态”提供，我们不保证服务不中断或 AI 输出无错误。"),
          p("在法律允许的最大范围内，任何一方均不对间接、附带、特殊、惩罚性或后果性损失，以及不可合理预见的利润、收入、商誉或数据损失承担责任。"),
          p("在法律允许的最大范围内，我们因服务产生的累计责任，以 100 美元或导致索赔事件前 12 个月您为 musuw 支付的金额中较高者为限。该限制不适用于法律不得限制的责任，包括欺诈、故意不当行为、因过失造成的死亡或人身伤害，以及强制性消费者权利。")
        ]
      },
      {
        heading: "14. 适用法律与争议",
        blocks: [
          p("本条款适用中华人民共和国法律，但不适用其冲突法规则。除强制性法律允许您在其他地点主张权利外，由运营方住所地有管辖权的法院管辖。"),
          p(`提出正式主张前，请通过 ${LEGAL_OPERATOR.supportEmail} 联系我们以尝试解决。任何条款均不限制不可放弃的消费者权利，也不限制您联系监管机构或消费者保护机构。`)
        ]
      },
      {
        heading: "15. 变更与联系",
        blocks: [
          p("我们可因产品、法律、安全或运营变化更新本条款，并公布生效日期。重大变化将在法律要求时另行通知；法律要求主动同意的，继续使用不会替代该同意。"),
          contact("联系运营方")
        ]
      }
    ]
  },
  "/privacy": {
    path: "/privacy",
    eyebrow: "隐私",
    title: "隐私政策",
    summary: "本政策说明 musuw 收集哪些个人信息、使用目的、保留期限、可能的处理方、跨境处理以及您可行使的权利。",
    updated,
    sections: [
      {
        heading: "1. 个人信息处理者与适用范围",
        blocks: [
          p(`${operator} 是为运营 musuw 而处理个人信息的个人信息处理者，但明确由其他主体独立决定处理目的和方式的情形除外。本政策适用于公开网站、账户、产品功能、支持及相关沟通。`),
          p(`隐私问题和权利请求可发送至 ${LEGAL_OPERATOR.supportEmail}。`),
          contact("提交隐私请求")
        ]
      },
      {
        heading: "2. 我们收集的信息",
        blocks: [
          list(
            "账户与联系信息，例如姓名、电子邮箱、账户标识、语言和工作空间成员关系。",
            "知识内容，例如您主动上传的文档、笔记、提示词、保存的答案、引用、主题、Wiki 页面、图谱链接和文件。",
            "使用与技术信息，例如功能事件、汇总页面性能指标、IP 地址、设备和浏览器信息、地区语言、时间戳、诊断、安全事件，以及使用时的 Cookie 或本地存储标识。",
            "支持与沟通信息，包括消息、附件、反馈和解决请求所需记录。",
            "交易信息，例如套餐、金额、币种、计费周期、交易标识、付款状态、税务地区和付款服务商提供的有限收据信息。我们不接收或存储完整银行卡号。"
          )
        ]
      },
      {
        heading: "3. 信息来源",
        blocks: [
          p("信息可能直接来自您、您使用服务时的设备、邀请您的工作空间管理员、您授权的集成，以及参与交付服务的付款、反欺诈、支持或基础设施服务商。"),
          p("Cloudflare 可能向我们提供国家或地区代码，用于向中国大陆访问者显示中文、向其他访问者显示英文。我们不会借此推断精确位置。"),
          p("Cloudflare 在公开网站边缘处理请求元数据，用于内容交付、TLS、滥用防护和国家或地区层级的语言选择。当前官网不加载分析或广告信标。")
        ]
      },
      {
        heading: "4. 处理目的和依据",
        blocks: [
          list(
            "履行与您的合同并提供您请求的服务和功能。",
            "处理账户、购买、订阅、支持和产品通知，以履行合同并满足合理运营利益。",
            "保障安全、排查故障、防止欺诈和滥用、执行政策并保持可审计性，以满足合法利益和法定义务。",
            "履行税务、会计、制裁、执法及其他法律义务。",
            "在允许范围内使用汇总、去标识化或有限服务数据改进可用性和可靠性。",
            "仅在法律要求时取得同意后发送可选营销信息，您可随时退订。"
          ),
          p("依赖同意处理时，您可随时撤回，但不影响撤回前处理的合法性；依赖合法利益时，您可按下文方式提出异议。")
        ]
      },
      {
        heading: "5. 知识内容与 AI 处理",
        blocks: [
          p("musuw 处理您选择的来源范围和提示词，以检索证据并生成请求的输出。为完成您主动请求的 AI 功能，必要范围内的提示词、检索片段、图片、音频或视频可能经 OpenRouter 发送给所选模型对应的模型方和推理服务商；向量化和重排会发送建立索引或排序来源所需的文本。"),
          p("OpenRouter 声明其不使用 API 输入或输出训练模型，但下游模型方或推理服务商的保留和训练做法可能不同。产品会显示所选模型；提交敏感内容前请查看 OpenRouter 最新服务商信息，如需确认某次请求的处理路径可联系我们。"),
          p("我们不出售私人工作空间内容，也不将其用于跨场景行为广告。我们不会仅通过自动化方式对您作出具有法律或类似重大影响的决定。"),
          p("请避免上传不必要的敏感个人信息。若您使用 musuw 处理他人信息，您有责任具备适当处理依据、提供必要告知并尊重其权利。")
        ]
      },
      {
        heading: "6. 服务商、委托处理与接收方清单",
        blocks: [
          p("我们仅在履行以下职责所合理必要的范围提供个人信息。目前主要服务商和独立接收方如下："),
          list(
            "Supabase, Inc. 提供身份认证和一次性验证码服务，为此处理账户邮箱、资料声明、身份标识以及登录和会话数据。",
            "Resend, Inc. 发送身份认证事务邮件，为此处理收件地址、认证邮件内容和元数据，以及投递与安全事件。",
            "您选择 Google 登录时，Google LLC 处理 Google 账户数据。musuw 仅请求 openid、profile 和 email 范围，并接收 Google 就这些范围返回的标识和资料字段。",
            "Cloudflare, Inc. 提供 DNS 与边缘交付、传输安全、滥用防护、国家或地区层级语言选择和 R2 对象存储，为此可能处理 IP 与请求元数据、安全信号和上传的原始资料对象。",
            "OpenRouter, Inc. 将提示词、相关来源片段、媒体、模型请求、用量和范围化用户追踪标识路由给所选模型方和推理服务商。当前模型目录包括 DeepSeek、阿里云 Qwen、OpenAI、Google、Anthropic 和 Cohere 开发的模型；具体推理路由及其做法可能因模型而异。",
            "Langfuse GmbH 在其日本云区域提供生产 AI 可观测与故障排查。为运营和排查用户请求的 AI 功能，范围受限的追踪可能包含提示词或查询、检索或来源预览、模型回复、模型与工具标识、用量、延迟和错误元数据。",
            "Paddle 相关实体作为 musuw 付费订单的授权经销商和商户记录方，依据其买家条款和隐私政策处理买家联系、交易、税务地区、付款、收据、反欺诈、订阅、取消和退款数据。",
            "在法律要求或为保护权利与安全所合理必要时的专业顾问、审计人员、监管机构、法院和主管机关。",
            "合并、融资、重组或出售中的继受方，但须采取适当保密和告知措施。"
          ),
          p("我们不以金钱为对价出售个人信息，也不为跨场景行为广告共享个人信息。"),
          link("Supabase 隐私政策", "https://supabase.com/privacy"),
          link("Resend 隐私政策", "https://resend.com/legal/privacy-policy"),
          link("Google 隐私政策", "https://policies.google.com/privacy"),
          link("Cloudflare 隐私政策", "https://www.cloudflare.com/privacypolicy/"),
          link("OpenRouter 隐私政策", "https://openrouter.ai/privacy"),
          link("Langfuse 隐私政策", "https://langfuse.com/privacy"),
          link("Langfuse 数据区域", "https://langfuse.com/security/data-regions"),
          link("Paddle 隐私声明", "https://www.paddle.com/legal/privacy")
        ]
      },
      {
        heading: "7. 跨境处理",
        blocks: [
          p("musuw 及其服务商可能在您所在国家或地区之外处理信息。法律要求跨境传输保护措施时，我们会采用获认可的传输机制、合同保护、适当同意或其他合法依据，并在需要时采取补充技术和组织措施。"),
          p("在不违反合法保密限制的前提下，您可联系我们了解适用于本人信息的跨境保护措施。")
        ]
      },
      {
        heading: "8. 保留与删除",
        blocks: [
          p("账户处于活动状态或提供服务所需期间，我们会保留账户和知识内容。收到经核验的删除请求或账户关闭后，我们会在不无故拖延的情况下从活动系统删除或去标识化，但可能受法定留存、安全调查、争议和正常备份轮换限制。"),
          p("交易、税务、会计、反欺诈和法律记录按适用法律要求或允许的期限保留。安全日志和支持记录仅在实现其目的所合理需要的期限内保留。"),
          p("信息不再需要时，我们会删除、去标识化或安全隔离。无法合理重新关联到您的去标识化信息可继续保留。")
        ]
      },
      {
        heading: "9. 您的权利",
        blocks: [
          p("根据您所在地区，您可能享有知情、查阅、复制、更正、删除、限制或拒绝处理、获取可携带副本、撤回同意，以及申诉或向监管机构投诉等权利。"),
          p("加利福尼亚居民还可能享有知情、删除、更正、在适用时限制敏感信息使用、选择退出出售或共享，以及不受差别待遇的权利。musuw 不出售个人信息，也不为跨场景行为广告共享个人信息。"),
          p(`行使权利、撤回同意或注销账户时，请使用账户邮箱向 ${LEGAL_OPERATOR.supportEmail} 发送邮件，并以“Privacy request”或“Account deletion”为主题。您可通过产品控件删除单篇文档或知识库。我们可能进行适度身份核验，仅在法律允许时拒绝或限制请求。授权代理人须提供有效授权。`),
          p("我们将在适用法律规定期限内答复。若请求被拒绝，可回复邮件并以“隐私申诉”为主题提出申诉，也可向所在地个人信息保护、数据保护或消费者保护机构投诉。")
        ]
      },
      {
        heading: "10. 安全措施",
        blocks: [
          p("我们采取旨在保护个人信息的技术和组织措施，包括范围化访问、服务凭据服务器端处理、传输加密、日志、精确证据链接和在支持范围内的数据生命周期控制。"),
          p("任何系统都无法保证绝对安全。请为 Google 账户和邮箱启用多因素认证并维护有效的恢复渠道、保护设备，并及时报告疑似未授权访问。"),
          link("查看安全概览", "/security")
        ]
      },
      {
        heading: "11. Cookie 与类似技术",
        blocks: [
          p("当前公开官网不加载分析或广告追踪。Cloudflare 按上文说明处理边缘请求和安全元数据。我们不使用广告 Cookie 或跨站行为追踪；仅为语言、身份认证、安全和结账返回状态使用必要浏览器存储。外部身份和结账服务商可依据其告知使用必要技术。"),
          link("查看 Cookie 说明", "/cookies")
        ]
      },
      {
        heading: "12. 未成年人",
        blocks: [
          p("musuw 不面向 16 岁以下儿童，我们不会明知而收集其个人信息。如您认为儿童未经有效授权提交了个人信息，请联系我们调查并在法律要求时删除。")
        ]
      },
      {
        heading: "13. 政策变更与联系",
        blocks: [
          p("产品、服务商或法律义务发生变化时，我们可能更新本政策，并公布新的生效日期。重大变化将在法律要求时另行通知。"),
          contact("联系隐私团队")
        ]
      }
    ]
  },
  "/refund-policy": {
    path: "/refund-policy",
    eyebrow: "购买",
    title: "退款政策",
    summary: "musuw 为初次真实付款和最近一次订阅续费提供 30 个日历日的退款申请期限，同时完整保留强制性消费者权利。",
    updated,
    sections: [
      {
        heading: "1. 已验证的付费订单",
        blocks: [
          note("本政策适用于 musuw 已通过有效签名通知确认的 Paddle 完成交易。仅返回浏览器结账页面不能证明已形成付费订单。"),
          p("Paddle 收据和 musuw 账单页会显示用于支持与退款审核的交易标识和当前账单状态。")
        ]
      },
      {
        heading: "2. 30 天退款承诺",
        blocks: [
          p("您可在初次真实付款后 30 个日历日内，或最近一次订阅续费后 30 个日历日内申请全额退款。"),
          p("该申请期限适用于月度和年度续费。退款通常会终止该笔订单对应的付费访问权，不会自动退还申请期限以外更早的计费周期。"),
          p("存在可信欺诈、退款滥用、重复追偿或进行中拒付时，我们可拒绝酌情退款，但该例外绝不限制强制性消费者权利。")
        ]
      },
      {
        heading: "3. 如何申请",
        blocks: [
          list(
            "使用付款收据中的退款或买家支持链接。",
            "使用适用付款服务商的客户或交易门户。",
            `发送邮件至 ${LEGAL_OPERATOR.supportEmail}，提供账户邮箱、交易标识、购买日期和简短说明。`
          ),
          p("我们力争在 3 个工作日内确认支持请求。请勿发送完整银行卡号、密码、政府证件号码或其他不必要的敏感信息。"),
          contact("申请退款")
        ]
      },
      {
        heading: "4. 谁处理退款",
        blocks: [
          p("Paddle 会在可能时将退款退回原付款方式。请使用 Paddle 收据、客户门户或买家支持流程。"),
          p("我们会与商户记录方配合并履行本政策的 30 天承诺，但交易核验、支付网络处理时间、汇率换算和服务商买家条款可能影响退款到账方式。")
        ]
      },
      {
        heading: "5. 时间与访问权",
        blocks: [
          p("退款获批后，会在可能时原路提交，通常在批准后 14 日内完成提交；银行或支付网络可能需要额外时间显示入账。"),
          p("全额退款完成后，相应付费权益可能立即终止。申请删除前，请先导出您有权保留的材料。")
        ]
      },
      {
        heading: "6. 缺陷、描述不符与法定权利",
        blocks: [
          p("若 musuw 存在重大缺陷、与描述不符或未以法律要求的合理注意提供，即使超过 30 个日历日也请联系我们。适用法律要求的救济仍然有效。"),
          p("本政策不排除或限制强制性消费者权利、法定撤回权或付款服务商提供的买家保护。不同规则并存时，以不可放弃的最高保护为准。")
        ]
      },
      {
        heading: "7. 取消与退款不同",
        blocks: [
          p("取消订阅会停止未来续费，但不会自动退还已经完成的扣款。退款须根据本政策另行申请。"),
          link("查看订阅与取消政策", "/subscription-policy")
        ]
      }
    ]
  },
  "/subscription-policy": {
    path: "/subscription-policy",
    eyebrow: "账单",
    title: "订阅与取消政策",
    summary: "本政策说明自动续费、计费周期、取消方式、套餐变更，以及循环订阅和单次购买之间的明确区别。",
    updated,
    sections: [
      {
        heading: "1. 您购买的内容",
        blocks: [
          p("结账前，musuw 会显示报价属于循环订阅还是单次购买，并显示套餐、价格、币种、计费周期和所含功能。"),
          p("单次购买不会自动续费；循环订阅会按所选月度或年度周期自动续费，直至取消。")
        ]
      },
      {
        heading: "2. 扣款与税费",
        blocks: [
          p("循环套餐会由商户记录方在每个新计费周期开始时向留存付款方式扣款。适用税费和支持的本地币种金额会在结账时计算或披露。"),
          p("扣款失败时，付款服务商可能重试并通知您。合理通知后仍未付款的，访问权可能受到限制。")
        ]
      },
      {
        heading: "3. 如何取消",
        blocks: [
          list(
            "打开收据中的管理订阅链接。",
            "使用该订单对应的 Paddle 客户门户。",
            "生产账户账单功能可用时，使用产品内账单入口。",
            `使用账户邮箱联系 ${LEGAL_OPERATOR.supportEmail} 并提供交易标识。`
          ),
          p("我们力争在 3 个工作日内回应。为避免下一次扣款，请在续费日前提交取消，并为身份和交易核验预留合理时间。"),
          contact("请求取消")
        ]
      },
      {
        heading: "4. 取消后的效果",
        blocks: [
          p("取消会停止未来自动续费。除退款或强制性法律另有规定外，付费访问权持续至当前计费周期结束，之后不再产生订阅扣款。"),
          p("删除应用、不使用服务或移除支付应用不一定会取消订阅，请使用上述任一正式取消方式。")
        ]
      },
      {
        heading: "5. 套餐和价格变更",
        blocks: [
          p("升级可能立即生效，并在确认前披露按比例计算的扣款或抵扣；降级通常在下次续费时生效，除非页面另有说明。"),
          p("现有订阅发生重大涨价前，我们会至少提前 30 个日历日通知，税费或法律要求更短时间的除外。您可在新价格生效前取消。")
        ]
      },
      {
        heading: "6. 续费提醒与收据",
        blocks: [
          p("商户记录方会为每笔真实付款发送收据。法律要求或服务商支持时会发送续费提醒。您有责任保持账户和收据邮箱有效。")
        ]
      },
      {
        heading: "7. 退款与强制性权利",
        blocks: [
          p("取消与退款不同。取消阻止未来续费；退款撤销符合条件的已完成交易。我们的 30 个日历日退款申请期覆盖最近一次续费。"),
          link("查看退款政策", "/refund-policy"),
          p("本政策不限制任何强制性消费者权利。")
        ]
      }
    ]
  },
  "/acceptable-use": {
    path: "/acceptable-use",
    eyebrow: "信任",
    title: "可接受使用政策",
    summary: "本政策通过明确禁止的内容、行为、自动化使用和安全滥用，保护 musuw 用户、基础设施与第三方权利。",
    updated,
    sections: [
      {
        heading: "1. 基本规则",
        blocks: [p("请合法、负责地使用 musuw，并仅处理您获授权访问的内容和系统。您对本人内容、提示词、配置的集成及输出用途负责。")]
      },
      {
        heading: "2. 违法与有害活动",
        blocks: [
          p("不得利用 musuw 协助违法、暴力、剥削、人口贩运、恐怖主义、规避制裁、受管制武器或意图造成人身和重大财产损害的指示。"),
          p("不得威胁、骚扰、跟踪、歧视、剥削或公开他人隐私，也不得制作或传播未经同意的私密内容。")
        ]
      },
      {
        heading: "3. 权利与隐私",
        blocks: [
          p("不得上传或处理您无权使用的材料，不得侵犯知识产权、隐私权、公开权、保密义务、合同权利、数据库权利或其他权利。"),
          p("不得以欺骗方式收集凭据、敏感信息或个人信息，也不得将 musuw 用于非法监控或身份识别。")
        ]
      },
      {
        heading: "4. 安全与平台滥用",
        blocks: [
          list(
            "禁止恶意软件、勒索软件、破坏性代码、凭据窃取、网络钓鱼或欺诈。",
            "禁止未经授权的漏洞扫描、渗透测试、访问、拦截或干扰。",
            "禁止绕过身份验证、工作空间隔离、额度、付款控制、速率限制或安全机制。",
            "禁止严重降低服务性能或违反已发布限制的抓取和自动化流量。",
            "除不可放弃的法律明确允许范围外，禁止逆向工程。"
          )
        ]
      },
      {
        heading: "5. 欺骗与重大影响决定",
        blocks: [
          p("不得冒充他人、伪造来源、将 AI 输出虚假表示为已核验事实，也不得用于垃圾信息、诈骗、虚假互动或支付滥用。"),
          p("除非独立满足合格人工复核、告知、公平、解释和申诉等要求，不得将 musuw 作为就业、信贷、住房、教育、保险、医疗、法律权利或基本服务决定的唯一依据。")
        ]
      },
      {
        heading: "6. 敏感和受监管用途",
        blocks: [p("musuw 是通用知识工具，不是受监管的专业服务。不得利用其非法提供医疗、法律、财务、信贷、博彩或其他受监管服务，也不得规避许可和合规义务。")]
      },
      {
        heading: "7. 执行与申诉",
        blocks: [
          p("我们可调查可信举报，并按比例限制内容、集成或账户以防止损害。严重或重复违规可导致暂停或终止；法律要求时可保留和披露信息。"),
          p("适当时会考虑背景、严重性、重复程度、用户意图和可行补救。除会产生风险或违反法律外，我们可提供通知和申诉机会。")
        ]
      },
      {
        heading: "8. 举报滥用",
        blocks: [
          p(`请向 ${LEGAL_OPERATOR.supportEmail} 提交足以定位问题的信息，并避免附带不必要的敏感信息。`),
          contact("举报滥用")
        ]
      }
    ]
  },
  "/cookies": {
    path: "/cookies",
    eyebrow: "隐私",
    title: "Cookie 说明",
    summary: "本说明介绍 musuw 官网和产品使用的有限浏览器存储，包括必要偏好、安全状态与外部结账技术。",
    updated,
    sections: [
      {
        heading: "1. 当前官网做法",
        blocks: [
          p("当前 musuw 公开官网不加载分析或广告信标。Cloudflare 为交付和保护网站处理边缘请求与安全元数据，并提供仅用于语言选择的国家或地区代码。"),
          p("官网不设置广告 Cookie，也不进行跨站行为追踪。所选语言存储在必要的 musuw_locale Cookie 中，最长保留一年；我们不存储精确位置。"),
          p("如未来引入使用非必要浏览器存储的分析工具或广告技术，我们会更新本说明，并在法律要求时先取得同意。")
        ]
      },
      {
        heading: "2. 必要存储",
        blocks: [
          p("musuw 可能使用为保持登录、保护会话、记住语言或无障碍偏好、保留结账返回状态、防止滥用及提供所请求功能而必需的 Cookie、本地存储或类似浏览器功能。"),
          p("必要存储有时无法通过同意控件关闭，因为关闭后账户或安全功能可能无法使用。您可通过浏览器设置清除。")
        ]
      },
      {
        heading: "3. 付款服务商技术",
        blocks: [p("打开 Paddle 结账时，Paddle 可能依据其说明使用必要 Cookie 或类似技术，以完成反欺诈、付款处理、税费确定、本地化和买家支持。")]
      },
      {
        heading: "4. 管理浏览器存储",
        blocks: [
          p("多数浏览器允许查看、阻止或删除 Cookie 和站点数据。阻止必要存储可能影响登录、结账、偏好保存或其他请求的功能。"),
          p("浏览器的“请勿追踪”信号尚无统一法律标准。无论该信号如何，公开官网都不用于跨站行为广告。")
        ]
      },
      {
        heading: "5. 变更",
        blocks: [p("浏览器存储的类别、用途或服务商发生重大变化时，我们会更新本说明。页面顶部日期标识当前版本。")]
      },
      {
        heading: "6. 联系方式",
        blocks: [contact("联系隐私支持")]
      }
    ]
  },
  "/security": {
    path: "/security",
    eyebrow: "信任",
    title: "安全概览",
    summary: "musuw 围绕范围化知识访问、证据保留、精确引用、服务器端凭据和可见数据生命周期控制进行设计。",
    updated,
    sections: [
      {
        heading: "1. 安全方法",
        blocks: [
          p("我们根据服务和知识内容敏感程度采取分层技术和组织措施。安全是持续风险管理过程，不能保证事件永远不会发生。"),
          p("托管产品通过范围化的边缘和服务器边界以 HTTPS 提供，应用发布使用不可变镜像版本。本页面说明当前产品控制，不声称尚未完成的外部认证或独立保证。")
        ]
      },
      {
        heading: "2. 工作空间与检索范围",
        blocks: [
          p("知识检索限定在已认证的工作空间，以及本次对话获授权的主题、来源和版本范围。访问控制在服务边界执行，而非仅依赖界面是否可见。"),
          p("用户仍应避免共享账户，并仅授予集成所需的最小权限。")
        ]
      },
      {
        heading: "3. 凭据与传输",
        blocks: [
          p("服务凭据和模型服务商密钥在服务器端处理，不应暴露于浏览器。生产流量通过 HTTPS 提供，敏感密钥与公开前端代码分离。"),
          p("付款凭据在商户记录方的结账页输入，musuw 不接收或存储完整银行卡号。")
        ]
      },
      {
        heading: "4. 证据与资料完整性",
        blocks: [
          p("musuw 保留原始资料和版本引用，使答案能够解析当时使用的证据。上传资料可被解析为 Wiki 页面及其中的图谱视图，答案仍能返回精确证据，也不会重写历史资料。"),
          p("这些控制提高可审计性，但不能替代用户对重要 AI 输出的审查。")
        ]
      },
      {
        heading: "5. 数据生命周期",
        blocks: [
          p("您可通过产品控件删除单篇文档和知识库；数据类型提供导出操作时可直接使用。账户级副本或删除请求请联系支持，由我们在核验后协调身份、应用、对象存储和服务商记录。法定留存、反欺诈、争议记录、安全日志和备份轮换可能按隐私政策说明延迟彻底移除。"),
          link("查看隐私政策", "/privacy")
        ]
      },
      {
        heading: "6. 运营与事件响应",
        blocks: [
          p("我们根据需要使用日志、依赖审查、访问限制、变更验证、备份和事件流程，检测、调查、遏制并恢复安全事件。"),
          p("若事件可能对受影响人员造成重大风险，我们会依法通知并提供可采取的保护措施。")
        ]
      },
      {
        heading: "7. 您的责任",
        blocks: [
          list(
            "为 Google 账户和邮箱启用多因素认证，并维护有效的恢复渠道。",
            "及时更新设备、浏览器和集成。",
            "使用满足需要的最小知识和集成范围。",
            "依赖重要输出前审查内容和证据。",
            "及时报告疑似未授权访问。"
          )
        ]
      },
      {
        heading: "8. 负责任披露",
        blocks: [
          p(`请向 ${LEGAL_OPERATOR.supportEmail} 发送疑似漏洞，邮件主题为“Security report”，并提供可复现细节。请勿访问、修改或保留不属于您的数据。`),
          p("目前我们不运营公开漏洞赏金计划。任何确认、资格或奖励均须另行书面约定。善意研究仍须遵守法律和可接受使用政策。"),
          contact("报告安全问题")
        ]
      }
    ]
  },
  "/contact": {
    path: "/contact",
    eyebrow: "支持",
    title: "联系 musuw",
    summary: "您可以联系 musuw 团队获取产品帮助、账单和取消支持、提交隐私权利请求、安全报告或支付审核问题。",
    updated,
    sections: [
      {
        heading: "运营主体",
        blocks: [
          p(LEGAL_OPERATOR.chineseName),
          p(LEGAL_OPERATOR.englishName),
          p("musuw 是本网站使用的产品名称。")
        ]
      },
      {
        heading: "客户支持",
        blocks: [
          p(`请发送邮件至 ${LEGAL_OPERATOR.supportEmail}。我们力争在 3 个工作日内确认客户支持请求。`),
          contact("发送支持邮件")
        ]
      },
      {
        heading: "账单、退款与取消",
        blocks: [
          p("为更快处理交易问题，请使用 Paddle 收据或客户门户中的订单管理链接，也可提供账户邮箱和交易标识联系我们。请勿发送完整银行卡号或密码。"),
          link("退款政策", "/refund-policy"),
          link("订阅与取消政策", "/subscription-policy")
        ]
      },
      {
        heading: "隐私与安全",
        blocks: [
          p("行使信息权利时请使用邮件主题“Privacy request”；报告疑似漏洞或未授权访问时请使用“Security report”，并仅提供调查所需信息。"),
          link("隐私政策", "/privacy"),
          link("安全概览", "/security")
        ]
      },
      {
        heading: "支付与审核咨询",
        blocks: [
          p("Paddle、税务、域名审核或企业身份问题，请附上相关商店、案件或交易标识。我们不会在官网公开私密审核文件。"),
          contact("联系运营方")
        ]
      }
    ]
  }
};

function normalizeLocale(locale) {
  return locale === "zh-CN" ? "zh-CN" : "en";
}

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  const path = pathname.split("?")[0].split("#")[0];
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function getPublicDocument(locale, pathname) {
  const documents = normalizeLocale(locale) === "zh-CN" ? chineseDocuments : englishDocuments;
  return documents[normalizePath(pathname)] ?? null;
}

export function getPublicDocumentMeta(locale, pathname) {
  const document = getPublicDocument(locale, pathname);
  if (!document) return null;
  return {
    title: `${document.title} | musuw`,
    description: document.summary
  };
}
