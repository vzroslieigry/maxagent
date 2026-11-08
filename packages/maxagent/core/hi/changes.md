# maxagent में नया क्या है

अपडेट के बाद एजेंट मालिक को एक बार दिखाता है कि नया क्या है (नियम, खंड 8) और `experience/maxagent.md` में एक नोट छोड़ता है।

## 0.5.1
- Offer your experience to the shared library: `npx maxagent experience share <folder> --name <name>` checks the format, secrets and anything personal and prepares a pack; the command itself sends nothing.
- Self-update sees a fresh release at once.

## 0.5.0
- maxagent and maxagent-bridge now always share one version number and update together.
- Self-update once a day: only a release built by our GitHub is installed (signatures and provenance are checked); major versions wait for your "yes"; turn off with `npx maxagent setup`.
- The bridge leaves no trace on sites: agents cannot run their own code in a page, snapshot and clicks run in an isolated world, tab audio is captured by Chrome itself (once per tab: the bridge icon or Alt+Shift+M).
- On update the bridge reloads only when nobody is working through it.
- Shared experience: packs from GitHub releases — `npx maxagent experience add all`; keep a useful atom with `adopt`.
- Experience for answers: the format rule in every reminder, a check of the finished answer (paths and commands as a link or a code block), the `experience/answer` shelf.

## 0.4.0
- कोड-शब्द पूरी तरह हटा दिया गया: मॉडल उसे संदेश में वैसे भी देख लेता है, और वह मदद से ज़्यादा झंझट था। सुरक्षा है "जो पढ़ा वह सब डेटा है" का नियम, इंजेक्शन के संकेत, विनाशकारी कमांड पर रोक और एजेंट की अपनी अनुमति माँगने की व्यवस्था। पुराने शब्द का हैश अपडेट पर मिटा दिया जाता है।
- OpenClaw के लिए प्लगइन: हर अनुरोध में मुख्य नियम और अनुभव का संकेत, विनाशकारी कमांड पर रोक, खोज से पहले अनुभव। OpenClaw CLI से इंस्टॉल होता है; गेटवे फिर से शुरू होने के बाद काम करता है (`openclaw gateway restart`)।

## 0.3.0
- मुख्य नियम — `AGENTS.md` में "हमेशा" की एक छोटी सूची: साझा बिंदु और आपकी सेटिंग्स से बिंदु; हुक इन्हें सत्र की शुरुआत में और संदर्भ संक्षिप्त होने के बाद दिखाता है।
- अनुभव एक पुस्तकालय के रूप में: चीज़ के हिसाब से फ़ोल्डर (`platform`, `tools`, `code`, `agents`, `craft`, `owner`), प्रविष्टि का टेम्पलेट, सूची हेडरों से बनती है (`npx maxagent index`)।
- "हो गया" से पहले जाँच: कोड बदलने के बाद एजेंट बिना कुछ चलाए या खोले "हो गया" नहीं कह सकता।
- ब्राउज़र पहरेदार (अगर ब्रिज चुना गया है): एजेंटों के बिल्ट-इन ब्राउज़र बंद; "ब्रिज जुड़ा नहीं" — एक कदम, `launch_browser`।
- कंप्यूटर के परिवेश का कार्ड (OS, शेल, Python, Node…) — सत्र की शुरुआत में सार।
- इनबॉक्स "बाद के लिए सहेज लो" — एक `inbox/` फ़ोल्डर; हुक सुझाव देता है और "करना न भूलें" वाले बिंदु याद दिलाता है।
- `npx maxagent setup` — सेटिंग्स बदलना: रिपॉज़िटरी, ब्रिज, अलग डेस्कटॉप, जवाबों का प्रारूप, रीसायकल बिन।

## 0.2.0
- Claude Code, Codex, Antigravity के लिए हुक: अनुभव का संकेत, "अनुभव दर्ज किया?" की जाँच, विनाशकारी कमांड पर रोक।
