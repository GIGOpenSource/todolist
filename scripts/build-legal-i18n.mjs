#!/usr/bin/env node
/**
 * Builds shared legal i18n for app + public website (20 product locales).
 * Source of truth for Privacy Policy & Terms of Use — store-review oriented.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const UPDATED = '2026-08-04'

/** @typedef {{ title: string, updated: string, paragraphs: string[] }} Doc */

/**
 * Placeholders: {email} in contact paragraphs.
 * Content covers App Store / Play expectations: collection, use, sharing,
 * retention/deletion, children, rights, transfers, contact, AI third-party.
 * @type {Record<string, { privacy: Doc, terms: Doc }>}
 */
const locales = {
  en: {
    privacy: {
      title: 'Privacy Policy',
      updated: `Last updated: ${UPDATED}`,
      paragraphs: [
        'Welcome to Upgrade (the “App”). We respect your privacy. This policy explains what information we collect, how we use and protect it, and the choices you have. By using the App, you acknowledge this policy.',
        '1. Information we collect\n• Account: username and a hashed password (we do not store plaintext passwords).\n• Profile: nickname, avatar, bio, and gender you choose to provide.\n• Task data: titles, details, due dates, and completion status for on-device use and cloud sync.\n• Technical logs: limited operational logs (e.g. request timing, error codes) to keep the service reliable. We do not collect advertising identifiers for ads, and we do not sell your personal information to advertisers.',
        '2. How we use information\n• To provide sign-in, profile management, task sync, statistics, and period reports.\n• If you use the optional AI report feature, related task text you choose to submit may be sent to a third-party large language model provider solely to generate the report. You can choose not to use that feature.\n• To maintain security and improve stability (for example, diagnosing failures).\n• We do not use your personal information for third-party advertising.',
        '3. Storage, retention, and deletion\n• Data is stored on servers we operate and on your device.\n• You may request account deletion in Profile. The account enters a 30-day soft-delete grace period during which you can sign in and restore it. After that period we permanently delete the account and related cloud data, except where law requires retention.\n• You may also delete or edit individual tasks in the App at any time.',
        '4. Sharing and disclosure\n• We do not sell your personal information.\n• We may disclose information only when: required by law or lawful authority; needed to protect users or public safety; you give clear consent; or you explicitly trigger AI report generation and we transmit the content you submit to the processor for that purpose.\n• Service providers that help us host or operate the App process data only on our instructions and for those purposes.',
        '5. Children\nThe App is not directed at children under 13 (or a higher age required in your jurisdiction). We do not knowingly collect personal information from such children. If we learn that we have collected it, we will delete it promptly.',
        '6. Your rights\n• Access and update your profile; manage your tasks.\n• Request account deletion and restore within the grace period.\n• Where applicable law provides (for example GDPR or similar frameworks), you may have rights to access, correct, delete, restrict processing, object, or lodge a complaint with a supervisory authority. Contact us to exercise these rights.',
        '7. International transfers\nServers or processors may be located in countries other than yours. Where transfers occur, we take reasonable safeguards appropriate to the circumstances. Continued use means you understand such transfers may happen.',
        '8. Contact\nQuestions about this policy: {email}, or use in-app feedback. If a public web copy of this policy is published, it will match the in-app text for the same version date.',
      ],
    },
    terms: {
      title: 'Terms of Use',
      updated: `Last updated: ${UPDATED}`,
      paragraphs: [
        'Please read these Terms of Use before using Upgrade. By registering for or using the App, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the App.',
        '1. Service\nUpgrade provides personal task management, cloud sync, statistics, and period reports. We may improve or change features over time and will communicate material changes in a reasonable way. Some capabilities (such as AI reports) depend on third-party services and may be unavailable at times.',
        '2. Accounts and acceptable use\n• Keep your credentials secure; you are responsible for activity under your account.\n• Do not use the service for unlawful, infringing, or harmful purposes, or to attack or disrupt the system.\n• You may request account deletion in Profile. Soft deletion can be canceled within 30 days; afterward deletion is permanent.',
        '3. Content and intellectual property\n• You retain rights to content you create and grant us the limited processing rights needed to operate the service (including storage, sync, and generating reports you request).\n• App trademarks, interface, and code belong to the developer or licensors. You may not copy, reverse engineer, or redistribute the App except as allowed by law.',
        '4. Disclaimer\nTo the extent allowed by applicable law, the service is provided “as is.” We will reasonably assist with outages caused by force majeure, networks, devices, or third-party services, but we do not make warranties beyond what the law requires. AI-generated content is for reference only and is not professional advice.',
        '5. Changes and termination\nWe may update these Terms; continued use after an update means acceptance of the revised Terms. We may limit or end access for serious violations of these Terms.',
        '6. Governing law\nIf a provision conflicts with mandatory applicable law, that law prevails and the remaining terms stay in effect. Disputes should first be resolved amicably; otherwise they may be brought in courts with jurisdiction where the developer is located, unless mandatory law requires otherwise.',
        '7. Contact\nQuestions about these Terms: {email}.',
      ],
    },
  },
}

// zh-Hans
locales['zh-Hans'] = {
  privacy: {
    title: '隐私政策',
    updated: `更新日期：${UPDATED}`,
    paragraphs: [
      '欢迎使用 Upgrade（本应用）。我们重视你的隐私。本政策说明我们收集哪些信息、如何使用与保护，以及你享有的选择。使用本应用即表示你已阅读并理解本政策。',
      '一、我们收集的信息\n• 账号信息：用户名与加密存储的密码哈希（我们不以明文保存密码）。\n• 资料信息：你主动填写的昵称、头像、签名、性别。\n• 任务数据：待办标题、详情、截止日期与完成状态，用于本地展示与云端同步。\n• 技术日志：为保障服务稳定，可能记录必要的运行日志（如请求时间、错误码）。我们不收集用于广告的广告标识符，也不会将你的个人信息出售给广告商。',
      '二、我们如何使用信息\n• 提供注册登录、资料管理、任务同步、统计与周期汇报等功能。\n• 若你使用可选的 AI 汇报功能，你主动提交的相关任务文本可能发送至第三方大模型服务以生成内容；你可选择不使用该功能。\n• 维护安全并改进产品稳定性（例如排查故障）。\n• 我们不会将你的个人信息用于第三方广告。',
      '三、存储、保留与删除\n• 数据存储在我们运营的服务器及你的设备本地。\n• 你可在「个人中心」申请删除账号：账号进入 30 天软删除宽限期，期内可登录并选择恢复；逾期后我们将永久删除账号及相关云端数据（法律要求保留的除外）。\n• 你也可随时在应用内编辑或删除单条任务。',
      '四、共享与披露\n• 我们不会出售你的个人信息。\n• 仅在以下情况可能披露必要信息：法律要求或有权机关依法调取；保护用户与公众安全；经你明确同意；为提供 AI 汇报而向处理方传输你主动触发并提交的内容。\n• 协助我们托管或运营本应用的服务商仅按我们的指示、出于上述目的处理数据。',
      '五、儿童隐私\n本应用不以 13 岁以下（或你所在司法辖区规定的更高年龄）儿童为主要服务对象。我们不会故意收集此类儿童的个人信息；若发现误收集，将尽快删除。',
      '六、你的权利\n• 访问与更正资料、管理任务数据。\n• 申请删除账号并在宽限期内恢复。\n• 在适用法律下（例如 GDPR 或类似框架），你可能享有访问、更正、删除、限制处理、反对或向监管机构投诉等权利。行使权利请联系我们。',
      '七、国际传输\n若服务器或第三方处理方位于其他国家/地区，我们会在合理范围内采取适当保护措施。继续使用本服务即表示你理解相关传输可能发生。',
      '八、联系我们\n如对本政策有疑问，请发送邮件至 {email}，或通过应用内反馈渠道联系我们。若发布公开网页版，将与同版本日期的应用内文本保持一致。',
    ],
  },
  terms: {
    title: '用户协议',
    updated: `更新日期：${UPDATED}`,
    paragraphs: [
      '请在使用 Upgrade 前仔细阅读本协议。继续注册或使用，即表示你同意本协议及《隐私政策》。如不同意，请勿使用本应用。',
      '一、服务说明\nUpgrade 提供个人待办管理、云端同步、统计与周期汇报等功能。我们可能持续改进功能，必要时将以合理方式通知重大变更。部分能力（如 AI 汇报）依赖第三方服务，可用性可能受其影响。',
      '二、账号与合理使用\n• 你应妥善保管账号与密码，对账号下的行为负责。\n• 不得利用本服务从事违法、侵权或妨害他人的活动，不得尝试破坏或干扰系统安全。\n• 你可以在「个人中心」申请删除账号；软删除后 30 天内可取消，逾期将永久删除。',
      '三、内容与知识产权\n• 你保留自己创建内容的权利，并授予我们为提供服务所必需的有限处理权限（含存储、同步、按你的操作生成汇报）。\n• 本应用的商标、界面与代码等归开发者或其许可方所有。除法律允许外，不得复制、逆向工程或再分发本应用。',
      '四、免责声明\n在法律允许范围内，服务按「现状」提供。因不可抗力、网络、设备或第三方服务中断导致的损失，我们将在合理范围内尽力协助，但不作超出法律规定的保证。AI 生成内容仅供参考，不构成专业建议。',
      '五、协议变更与终止\n我们可更新本协议；更新后继续使用视为接受修订后的协议。严重违反协议时，我们可限制或终止服务。',
      '六、适用说明\n如本协议与适用法律法规的强制性规定冲突，以该规定为准；其余条款继续有效。争议应首先友好协商；协商不成的，按开发者所在地有管辖权的法院处理（法律另有强制规定的除外）。',
      '七、联系我们\n有关本协议的问题，请联系 {email}。',
    ],
  },
}

locales["zh-Hant"] = {
  "privacy": {
    "title": "隱私政策",
    "updated": "更新日期：2026-08-04",
    "paragraphs": [
      "歡迎使用 Upgrade（本應用）。我們重視你的隱私。本政策說明我們收集哪些資訊、如何使用與保護，以及你享有的選擇。使用本應用即表示你已閱讀並理解本政策。",
      "一、我們收集的資訊\n• 帳號資訊：用戶名與加密儲存的密碼雜湊（我們不以明文保存密碼）。\n• 資料資訊：你主動填寫的暱稱、頭像、簽名、性別。\n• 任務資料：待辦標題、詳情、截止日期與完成狀態，用於本機展示與雲端同步。\n• 技術日誌：為保障服務穩定，可能記錄必要的運行日誌（如請求時間、錯誤碼）。我們不收集用於廣告的廣告識別符，也不會將你的個人資訊出售給廣告商。",
      "二、我們如何使用資訊\n• 提供註冊登入、資料管理、任務同步、統計與週期彙報等功能。\n• 若你使用可選的 AI 彙報功能，你主動提交的相關任務文本可能發送至第三方大模型服務以生成內容；你可選擇不使用該功能。\n• 維護安全並改進產品穩定性（例如排查故障）。\n• 我們不會將你的個人資訊用於第三方廣告。",
      "三、儲存、保留與刪除\n• 資料儲存在我們營運的伺服器及你的裝置本機。\n• 你可在「個人中心」申請刪除帳號：帳號進入 30 天軟刪除寬限期，期內可登入並選擇恢復；逾期後我們將永久刪除帳號及相關雲端資料（法律要求保留的除外）。\n• 你也可隨時在應用內編輯或刪除單條任務。",
      "四、共享與披露\n• 我們不會出售你的個人資訊。\n• 僅在以下情況可能披露必要資訊：法律要求或有權機關依法調取；保護用戶與公眾安全；經你明確同意；為提供 AI 彙報而向處理方傳輸你主動觸發並提交的內容。\n• 協助我們託管或營運本應用的服務商僅按我們的指示、出於上述目的處理資料。",
      "五、兒童隱私\n本應用不以 13 歲以下（或你所在司法轄區規定的更高年齡）兒童為主要服務對象。我們不會故意收集此類兒童的個人資訊；若發現誤收集，將儘快刪除。",
      "六、你的權利\n• 存取與更正資料、管理任務資料。\n• 申請刪除帳號並在寬限期内恢復。\n• 在適用法律下（例如 GDPR 或類似框架），你可能享有存取、更正、刪除、限制處理、反對或向監管機構投訴等權利。行使權利請聯絡我們。",
      "七、國際傳輸\n若伺服器或第三方處理方位於其他國家／地區，我們會在合理範圍內採取適當保護措施。繼續使用本服務即表示你理解相關傳輸可能發生。",
      "八、聯絡我們\n如對本政策有疑問，請發送郵件至 {email}，或透過應用內反饋管道聯絡我們。若發布公開網頁版，將與同版本日期的應用內文本保持一致。"
    ]
  },
  "terms": {
    "title": "用戶協議",
    "updated": "更新日期：2026-08-04",
    "paragraphs": [
      "請在使用 Upgrade 前仔細閱讀本協議。繼續註冊或使用，即表示你同意本協議及《隱私政策》。如不同意，請勿使用本應用。",
      "一、服務說明\nUpgrade 提供個人待辦管理、雲端同步、統計與週期彙報等功能。我們可能持續改進功能，必要時將以合理方式通知重大變更。部分能力（如 AI 彙報）依賴第三方服務，可用性可能受其影響。",
      "二、帳號與合理使用\n• 你應妥善保管帳號與密碼，對帳號下的行為負責。\n• 不得利用本服務從事違法、侵權或妨害他人的活動，不得嘗試破壞或干擾系統安全。\n• 你可以在「個人中心」申請刪除帳號；軟刪除後 30 天內可取消，逾期將永久刪除。",
      "三、內容與智慧財產權\n• 你保留自己建立內容的權利，並授予我們為提供服務所必需的有限處理權限（含儲存、同步、按你的操作生成彙報）。\n• 本應用的商標、介面與程式碼等歸開發者或其授權方所有。除法律允許外，不得複製、逆向工程或再分發本應用。",
      "四、免責聲明\n在法律允許範圍內，服務按「現狀」提供。因不可抗力、網路、裝置或第三方服務中斷導致的損失，我們將在合理範圍內盡力協助，但不作超出法律規定的保證。AI 生成內容僅供參考，不構成專業建議。",
      "五、協議變更與終止\n我們可更新本協議；更新後繼續使用視為接受修訂後的協議。嚴重違反協議時，我們可限制或終止服務。",
      "六、適用說明\n如本協議與適用法律法規的強制性規定衝突，以該規定為準；其餘條款繼續有效。爭議應首先友好協商；協商不成的，按開發者所在地有管轄權的法院處理（法律另有強制規定的除外）。",
      "七、聯絡我們\n有關本協議的問題，請聯絡 {email}。"
    ]
  }
};
locales["ja"] = {
  "privacy": {
    "title": "プライバシーポリシー",
    "updated": "最終更新日：2026-08-04",
    "paragraphs": [
      "Upgrade（本アプリ）へようこそ。当社はプライバシーを尊重します。本ポリシーは、収集する情報、その利用・保護方法、およびお客様の選択肢を説明します。本アプリの利用により、本ポリシーを確認したものとみなされます。",
      "1. 収集する情報\n• アカウント：ユーザー名およびハッシュ化されたパスワード（平文のパスワードは保存しません）。\n• プロフィール：任意で提供するニックネーム、アバター、自己紹介、性別。\n• タスクデータ：タイトル、詳細、期限、完了状態（端末表示およびクラウド同期用）。\n• 技術ログ：サービス安定のための限定的な運用ログ（リクエスト時刻、エラーコードなど）。広告用の広告識別子は収集せず、個人情報を広告主に販売しません。",
      "2. 情報の利用\n• ログイン、プロフィール管理、タスク同期、統計、期間レポートの提供。\n• 任意の AI レポート機能を使う場合、送信を選択した関連タスク文言がレポート生成のため第三者の大規模言語モデル提供者に送られることがあります。当該機能を使わないこともできます。\n• セキュリティ維持と安定性向上（障害診断など）。\n• 個人情報を第三者広告に利用しません。",
      "3. 保存・保持・削除\n• データは当社が運用するサーバーおよびお客様の端末に保存されます。\n• プロフィールからアカウント削除を申請できます。30日間のソフト削除猶予期間中はログインして復元できます。その後、法令により保持が必要な場合を除き、アカウントおよび関連クラウドデータを完全削除します。\n• アプリ内で個別タスクを随時編集・削除できます。",
      "4. 共有と開示\n• 個人情報を販売しません。\n• 次の場合に限り必要な情報を開示することがあります：法令または権限ある当局の要求、ユーザー・公共の安全保護、明確な同意、AI レポート生成のためお客様が明示的に送信した内容の処理。\n• ホスティング等の委託先は当社の指示に従い、当該目的でのみ処理します。",
      "5. 子どものプライバシー\n本アプリは 13 歳未満（または管轄区域でより高い年齢）の子どもを対象としません。故意にそのような子どもの個人情報を収集しません。収集が判明した場合は速やかに削除します。",
      "6. お客様の権利\n• プロフィールの閲覧・更新、タスクの管理。\n• アカウント削除の申請および猶予期間内の復元。\n• 適用法（GDPR 等）により、アクセス、訂正、削除、制限、異議申立て、監督機関への苦情申立などの権利がある場合があります。行使はご連絡ください。",
      "7. 国際転送\nサーバーまたは処理者が他国にある場合があります。転送時は状況に応じた合理的な保護措置を講じます。利用の継続は、かかる転送があり得ることを理解したものとみなされます。",
      "8. お問い合わせ\n本ポリシーに関するお問い合わせ：{email}、またはアプリ内フィードバック。公開ウェブ版がある場合、同一更新日のアプリ内テキストと一致します。"
    ]
  },
  "terms": {
    "title": "利用規約",
    "updated": "最終更新日：2026-08-04",
    "paragraphs": [
      "Upgrade をご利用前に本利用規約をお読みください。登録または利用により、本規約およびプライバシーポリシーに同意したものとみなされます。同意できない場合はご利用くださいません。",
      "1. サービス\nUpgrade は個人向けタスク管理、クラウド同期、統計、期間レポートを提供します。機能は改善・変更されることがあり、重要な変更は合理的な方法でお知らせします。一部機能（AI レポート等）は第三者サービスに依存し、利用できない場合があります。",
      "2. アカウントと適正利用\n• 認証情報を適切に管理し、アカウント上の行為に責任を負います。\n• 違法・侵害・有害な目的、またはシステムへの攻撃・妨害のためにサービスを使用してはなりません。\n• プロフィールからアカウント削除を申請できます。ソフト削除後 30 日以内は取消可能で、その後は完全削除となります。",
      "3. コンテンツと知的財産\n• 作成したコンテンツの権利はお客様に帰属し、サービス運営に必要な限定的処理権限（保存、同期、依頼に基づくレポート生成を含む）を当社に付与します。\n• アプリの商標、UI、コードは開発者または許諾者に帰属します。法令で認められる場合を除き、複製、リバースエンジニアリング、再配布はできません。",
      "4. 免責\n適用法が許容する範囲で、サービスは「現状有姿」で提供されます。不可抗力、ネットワーク、端末、第三者サービスによる中断については合理的に支援しますが、法が求める範囲を超える保証はしません。AI 生成内容は参考情報であり、専門的助言ではありません。",
      "5. 変更と終了\n本規約を更新することがあり、更新後の利用は改定への同意を意味します。重大な違反がある場合、アクセスを制限または終了できます。",
      "6. 準拠法\n条項が強行法規と抵触する場合はその法規が優先し、残りは有効です。紛争はまず誠実に協議し、解決しない場合は開発者所在地の管轄裁判所に提起できるものとします（強行法規に別段の定めがある場合を除く）。",
      "7. お問い合わせ\n本規約に関するお問い合わせ：{email}。"
    ]
  }
};
locales["ko"] = {
  "privacy": {
    "title": "개인정보 처리방침",
    "updated": "최종 업데이트: 2026-08-04",
    "paragraphs": [
      "Upgrade(본 앱)를 이용해 주셔서 감사합니다. 저희는 개인정보를 존중합니다. 본 방침은 수집하는 정보, 이용·보호 방법 및 선택권을 설명합니다. 앱을 사용하면 본 방침을 확인한 것으로 간주됩니다.",
      "1. 수집하는 정보\n• 계정: 사용자 이름 및 해시된 비밀번호(평문 비밀번호는 저장하지 않음).\n• 프로필: 제공을 선택한 닉네임, 아바타, 소개, 성별.\n• 할 일 데이터: 제목, 상세, 마감일, 완료 상태(기기 표시 및 클라우드 동기화용).\n• 기술 로그: 서비스 안정성을 위한 제한적 운영 로그(요청 시각, 오류 코드 등). 광고용 광고 식별자는 수집하지 않으며 개인정보를 광고주에게 판매하지 않습니다.",
      "2. 정보 이용\n• 로그인, 프로필 관리, 할 일 동기화, 통계, 기간 보고서 제공.\n• 선택적 AI 보고서 기능을 사용하는 경우, 제출을 선택한 관련 할 일 텍스트가 보고서 생성을 위해 제3자 대규모 언어 모델 제공자에게 전송될 수 있습니다. 해당 기능을 사용하지 않을 수 있습니다.\n• 보안 유지 및 안정성 개선(장애 진단 등).\n• 개인정보를 제3자 광고에 사용하지 않습니다.",
      "3. 저장, 보유 및 삭제\n• 데이터는 저희가 운영하는 서버와 기기에 저장됩니다.\n• 프로필에서 계정 삭제를 요청할 수 있습니다. 30일 소프트 삭제 유예 기간 동안 로그인하여 복원할 수 있습니다. 이후 법령상 보유가 필요한 경우를 제외하고 계정 및 관련 클라우드 데이터를 영구 삭제합니다.\n• 앱에서 개별 할 일을 언제든 편집·삭제할 수 있습니다.",
      "4. 공유 및 공개\n• 개인정보를 판매하지 않습니다.\n• 다음의 경우에만 필요한 정보를 공개할 수 있습니다: 법령 또는 권한 있는 기관의 요구, 사용자·공공 안전 보호, 명확한 동의, AI 보고서 생성을 위해 명시적으로 제출한 내용의 처리.\n• 호스팅 등 서비스 제공자는 저희 지시에 따라 해당 목적으로만 처리합니다.",
      "5. 아동 개인정보\n본 앱은 13세 미만(또는 관할권에서 요구하는 더 높은 연령) 아동을 대상으로 하지 않습니다. 해당 아동의 개인정보를 고의로 수집하지 않으며, 수집 사실을 알게 되면 즉시 삭제합니다.",
      "6. 권리\n• 프로필 열람·수정, 할 일 관리.\n• 계정 삭제 요청 및 유예 기간 내 복원.\n• 적용 법률(예: GDPR 등)에 따라 열람, 정정, 삭제, 처리 제한, 이의제기 또는 감독 기관 신고 등의 권리가 있을 수 있습니다. 권리 행사는 문의해 주세요.",
      "7. 국제 이전\n서버 또는 처리자가 다른 국가에 있을 수 있습니다. 이전이 이루어지는 경우 상황에 맞는 합리적 보호 조치를 취합니다. 계속 이용은 이러한 이전이 있을 수 있음을 이해한 것으로 간주됩니다.",
      "8. 문의\n본 방침 관련 문의: {email} 또는 앱 내 피드백. 공개 웹 버전이 게시된 경우 동일 업데이트 일자의 앱 내 텍스트와 일치합니다."
    ]
  },
  "terms": {
    "title": "이용약관",
    "updated": "최종 업데이트: 2026-08-04",
    "paragraphs": [
      "Upgrade를 사용하기 전에 본 이용약관을 읽어 주세요. 등록 또는 사용 시 본 약관 및 개인정보 처리방침에 동의한 것으로 간주됩니다. 동의하지 않으면 앱을 사용하지 마세요.",
      "1. 서비스\nUpgrade는 개인 할 일 관리, 클라우드 동기화, 통계, 기간 보고서를 제공합니다. 기능을 개선·변경할 수 있으며 중요한 변경은 합리적 방식으로 안내합니다. 일부 기능(AI 보고서 등)은 제3자 서비스에 의존하며 일시적으로 이용하지 못할 수 있습니다.",
      "2. 계정 및 허용 사용\n• 자격 증명을 안전하게 보관하고 계정 활동에 책임을 집니다.\n• 불법·침해·유해 목적 또는 시스템 공격·방해를 위해 서비스를 사용해서는 안 됩니다.\n• 프로필에서 계정 삭제를 요청할 수 있습니다. 소프트 삭제 후 30일 이내 취소 가능하며 이후에는 영구 삭제됩니다.",
      "3. 콘텐츠 및 지적재산\n• 생성한 콘텐츠에 대한 권리는 사용자에게 있으며, 서비스 운영에 필요한 제한적 처리 권한(저장, 동기화, 요청한 보고서 생성 포함)을 부여합니다.\n• 앱의 상표, UI, 코드는 개발자 또는 라이선스 제공자에게 귀속됩니다. 법이 허용하는 경우를 제외하고 복제, 리버스 엔지니어링, 재배포는 불가합니다.",
      "4. 면책\n적용법이 허용하는 범위에서 서비스는 “있는 그대로” 제공됩니다. 불가항력, 네트워크, 기기 또는 제3자 서비스 중단 시 합리적으로 지원하지만 법이 요구하는 범위를 넘는 보증은 하지 않습니다. AI 생성 내용은 참고용이며 전문적 조언이 아닙니다.",
      "5. 변경 및 종료\n본 약관을 업데이트할 수 있으며, 업데이트 후 계속 사용은 개정 약관 수락을 의미합니다. 중대한 위반 시 접근을 제한하거나 종료할 수 있습니다.",
      "6. 준거법\n조항이 강행 법규와 충돌하면 해당 법규가 우선하며 나머지 조항은 유효합니다. 분쟁은 우선 우호적으로 해결하며, 그렇지 않은 경우 강행 법규에 다른 정함이 없는 한 개발자 소재지 관할 법원에 제기할 수 있습니다.",
      "7. 문의\n본 약관 관련 문의: {email}."
    ]
  }
};
locales["fr"] = {
  "privacy": {
    "title": "Politique de confidentialité",
    "updated": "Dernière mise à jour : 2026-08-04",
    "paragraphs": [
      "Bienvenue sur Upgrade (l’« Application »). Nous respectons votre vie privée. Cette politique explique quelles informations nous collectons, comment nous les utilisons et les protégeons, et quels choix vous avez. En utilisant l’Application, vous reconnaissez cette politique.",
      "1. Informations collectées\n• Compte : nom d’utilisateur et mot de passe haché (nous ne stockons pas de mots de passe en clair).\n• Profil : surnom, avatar, bio et genre que vous choisissez de fournir.\n• Tâches : titres, détails, échéances et état d’achèvement pour l’usage local et la synchronisation cloud.\n• Journaux techniques : journaux opérationnels limités (ex. horodatage des requêtes, codes d’erreur) pour la fiabilité. Nous ne collectons pas d’identifiants publicitaires à des fins publicitaires et ne vendons pas vos données personnelles à des annonceurs.",
      "2. Utilisation des informations\n• Fournir la connexion, la gestion du profil, la synchronisation, les statistiques et les rapports périodiques.\n• Si vous utilisez la fonction optionnelle de rapport IA, le texte de tâches que vous choisissez d’envoyer peut être transmis à un fournisseur tiers de grand modèle de langage uniquement pour générer le rapport. Vous pouvez ne pas utiliser cette fonction.\n• Maintenir la sécurité et améliorer la stabilité (ex. diagnostic des pannes).\n• Nous n’utilisons pas vos données personnelles pour de la publicité tierce.",
      "3. Stockage, conservation et suppression\n• Les données sont stockées sur nos serveurs et sur votre appareil.\n• Vous pouvez demander la suppression du compte dans Profil. Le compte entre dans une période de grâce de 30 jours (suppression douce) pendant laquelle vous pouvez vous reconnecter et le restaurer. Ensuite, nous supprimons définitivement le compte et les données cloud associées, sauf obligation légale de conservation.\n• Vous pouvez aussi modifier ou supprimer des tâches individuellement à tout moment.",
      "4. Partage et divulgation\n• Nous ne vendons pas vos données personnelles.\n• Nous ne divulguons des informations que si : la loi ou une autorité compétente l’exige ; pour protéger les utilisateurs ou la sécurité publique ; avec votre consentement clair ; ou lorsque vous déclenchez explicitement un rapport IA et que nous transmettons le contenu soumis au prestataire à cette fin.\n• Les prestataires qui nous aident à héberger ou exploiter l’Application traitent les données uniquement sur nos instructions et à ces fins.",
      "5. Enfants\nL’Application ne s’adresse pas aux enfants de moins de 13 ans (ou un âge plus élevé requis dans votre juridiction). Nous ne collectons pas sciemment leurs données personnelles. Si nous apprenons en avoir collecté, nous les supprimerons rapidement.",
      "6. Vos droits\n• Accéder et mettre à jour votre profil ; gérer vos tâches.\n• Demander la suppression du compte et le restaurer pendant la période de grâce.\n• Lorsque la loi applicable le prévoit (ex. RGPD), vous pouvez avoir des droits d’accès, de rectification, d’effacement, de limitation, d’opposition ou de réclamation auprès d’une autorité. Contactez-nous pour les exercer.",
      "7. Transferts internationaux\nDes serveurs ou prestataires peuvent être situés dans d’autres pays. En cas de transfert, nous prenons des garanties raisonnables adaptées. L’utilisation continue signifie que vous comprenez que de tels transferts peuvent avoir lieu.",
      "8. Contact\nQuestions sur cette politique : {email}, ou via le retour in-app. Si une version web publique est publiée, elle correspondra au texte in-app de la même date de version."
    ]
  },
  "terms": {
    "title": "Conditions d’utilisation",
    "updated": "Dernière mise à jour : 2026-08-04",
    "paragraphs": [
      "Veuillez lire ces Conditions avant d’utiliser Upgrade. En vous inscrivant ou en utilisant l’Application, vous acceptez ces Conditions et notre Politique de confidentialité. Sinon, n’utilisez pas l’Application.",
      "1. Service\nUpgrade fournit la gestion de tâches personnelles, la synchronisation cloud, des statistiques et des rapports périodiques. Nous pouvons améliorer ou modifier les fonctionnalités et communiquerons les changements importants de façon raisonnable. Certaines capacités (rapports IA) dépendent de services tiers et peuvent être indisponibles.",
      "2. Comptes et usage acceptable\n• Protégez vos identifiants ; vous êtes responsable de l’activité sous votre compte.\n• N’utilisez pas le service à des fins illicites, contrefaisantes ou nuisibles, ni pour attaquer ou perturber le système.\n• Vous pouvez demander la suppression du compte dans Profil. La suppression douce peut être annulée sous 30 jours ; ensuite elle est définitive.",
      "3. Contenu et propriété intellectuelle\n• Vous conservez les droits sur le contenu que vous créez et nous accordez les droits de traitement limités nécessaires au service (stockage, sync, rapports demandés).\n• Les marques, l’interface et le code appartiennent au développeur ou aux concédants. Sauf autorisation légale, vous ne pouvez pas copier, désosser ou redistribuer l’Application.",
      "4. Avertissement\nDans la mesure permise par la loi, le service est fourni « en l’état ». Nous aiderons raisonnablement en cas d’interruptions dues à la force majeure, aux réseaux, appareils ou services tiers, sans garanties au-delà de la loi. Le contenu généré par l’IA est indicatif et ne constitue pas un conseil professionnel.",
      "5. Modifications et résiliation\nNous pouvons mettre à jour ces Conditions ; l’usage après mise à jour vaut acceptation. Nous pouvons limiter ou mettre fin à l’accès en cas de manquement grave.",
      "6. Droit applicable\nEn cas de conflit avec une disposition légale impérative, celle-ci prévaut et le reste demeure. Les litiges doivent d’abord être résolus à l’amiable ; à défaut, ils peuvent être portés devant les tribunaux du lieu du développeur, sauf disposition légale contraire.",
      "7. Contact\nQuestions sur ces Conditions : {email}."
    ]
  }
};
locales["de"] = {
  "privacy": {
    "title": "Datenschutzerklärung",
    "updated": "Zuletzt aktualisiert: 2026-08-04",
    "paragraphs": [
      "Willkommen bei Upgrade (die „App“). Wir achten Ihre Privatsphäre. Diese Erklärung beschreibt, welche Daten wir erheben, wie wir sie nutzen und schützen und welche Wahlmöglichkeiten Sie haben. Mit der Nutzung der App erkennen Sie diese Erklärung an.",
      "1. Welche Daten wir erheben\n• Konto: Benutzername und gehashtes Passwort (keine Klartextpasswörter).\n• Profil: Spitzname, Avatar, Bio und Geschlecht, die Sie angeben.\n• Aufgabendaten: Titel, Details, Fälligkeit und Status für lokale Nutzung und Cloud-Sync.\n• Technische Protokolle: begrenzte Betriebsprotokolle (z. B. Anfragezeiten, Fehlercodes) zur Zuverlässigkeit. Wir erheben keine Werbekennungen für Werbung und verkaufen Ihre personenbezogenen Daten nicht an Werbetreibende.",
      "2. Nutzung der Daten\n• Bereitstellung von Anmeldung, Profilverwaltung, Sync, Statistik und Periodenberichten.\n• Nutzen Sie die optionale KI-Berichtsfunktion, kann von Ihnen übermittelter Aufgabentext ausschließlich zur Berichterstellung an einen Drittanbieter für große Sprachmodelle gesendet werden. Sie können die Funktion ungenutzt lassen.\n• Sicherheit und Stabilität (z. B. Fehlerdiagnose).\n• Wir nutzen Ihre personenbezogenen Daten nicht für Drittwerbung.",
      "3. Speicherung, Aufbewahrung und Löschung\n• Daten werden auf von uns betriebenen Servern und auf Ihrem Gerät gespeichert.\n• Löschung können Sie im Profil beantragen. Das Konto geht in eine 30-tägige Soft-Delete-Frist, in der Sie sich anmelden und wiederherstellen können. Danach löschen wir Konto und zugehörige Cloud-Daten dauerhaft, soweit keine gesetzliche Aufbewahrungspflicht besteht.\n• Einzelne Aufgaben können Sie jederzeit bearbeiten oder löschen.",
      "4. Weitergabe\n• Wir verkaufen keine personenbezogenen Daten.\n• Offenlegung nur wenn: gesetzlich oder behördlich erforderlich; zum Schutz von Nutzern oder öffentlicher Sicherheit; mit klarer Einwilligung; oder wenn Sie einen KI-Bericht auslösen und wir den eingereichten Inhalt zu diesem Zweck an den Auftragsverarbeiter übermitteln.\n• Dienstleister zur Hosting/Betrieb verarbeiten Daten nur nach unserer Weisung und zu diesen Zwecken.",
      "5. Kinder\nDie App richtet sich nicht an Kinder unter 13 Jahren (oder einem höheren Alter Ihrer Rechtsordnung). Wir erheben wissentlich keine solchen Daten. Erfahren wir davon, löschen wir sie umgehend.",
      "6. Ihre Rechte\n• Profil einsehen/aktualisieren; Aufgaben verwalten.\n• Kontolöschung beantragen und innerhalb der Frist wiederherstellen.\n• Soweit anwendbares Recht (z. B. DSGVO) Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch oder Beschwerde bei einer Aufsichtsbehörde gewährt, kontaktieren Sie uns zur Ausübung.",
      "7. Internationale Übermittlungen\nServer oder Auftragsverarbeiter können in anderen Ländern stehen. Bei Übermittlungen ergreifen wir angemessene Schutzmaßnahmen. Fortgesetzte Nutzung bedeutet, dass Sie solche Übermittlungen verstehen.",
      "8. Kontakt\nFragen zu dieser Erklärung: {email} oder In-App-Feedback. Eine öffentliche Webfassung entspricht dem In-App-Text desselben Versionsdatums."
    ]
  },
  "terms": {
    "title": "Nutzungsbedingungen",
    "updated": "Zuletzt aktualisiert: 2026-08-04",
    "paragraphs": [
      "Bitte lesen Sie diese Nutzungsbedingungen vor der Nutzung von Upgrade. Mit Registrierung oder Nutzung stimmen Sie diesen Bedingungen und der Datenschutzerklärung zu. Stimmen Sie nicht zu, nutzen Sie die App nicht.",
      "1. Dienst\nUpgrade bietet persönliche Aufgabenverwaltung, Cloud-Sync, Statistik und Periodenberichte. Funktionen können sich ändern; wesentliche Änderungen teilen wir angemessen mit. Manche Funktionen (z. B. KI-Berichte) hängen von Diensten Dritter ab und können ausfallen.",
      "2. Konten und zulässige Nutzung\n• Schützen Sie Zugangsdaten; Sie sind für Aktivitäten unter Ihrem Konto verantwortlich.\n• Nutzen Sie den Dienst nicht rechtswidrig, verletzend oder schädigend und greifen Sie das System nicht an.\n• Kontolöschung im Profil möglich. Soft-Delete innerhalb von 30 Tagen widerrufbar; danach dauerhaft.",
      "3. Inhalte und IP\n• Sie behalten Rechte an Ihren Inhalten und gewähren uns die zur Leistungserbringung nötigen begrenzten Verarbeitungsrechte (Speicherung, Sync, angeforderte Berichte).\n• Marken, UI und Code gehören dem Entwickler oder Lizenzgebern. Außer gesetzlich erlaubt: kein Kopieren, Reverse Engineering oder Weiterverbreiten.",
      "4. Haftungsausschluss\nSoweit gesetzlich zulässig, wird der Dienst „wie besehen“ bereitgestellt. Bei Ausfällen durch höhere Gewalt, Netz, Geräte oder Dritte helfen wir angemessen, geben aber keine über das Gesetz hinausgehenden Garantien. KI-Inhalte sind nur zur Orientierung und keine Fachberatung.",
      "5. Änderungen und Beendigung\nWir können diese Bedingungen aktualisieren; weitere Nutzung gilt als Zustimmung. Bei schweren Verstößen können wir den Zugang einschränken oder beenden.",
      "6. Anwendbares Recht\nKollidiert eine Klausel mit zwingendem Recht, gilt dieses; der Rest bleibt wirksam. Streitigkeiten zuerst gütlich; sonst Gerichte am Sitz des Entwicklers, soweit zwingendes Recht nichts anderes verlangt.",
      "7. Kontakt\nFragen zu diesen Bedingungen: {email}."
    ]
  }
};
locales["es"] = {
  "privacy": {
    "title": "Política de privacidad",
    "updated": "Última actualización: 2026-08-04",
    "paragraphs": [
      "Bienvenido a Upgrade (la «App»). Respetamos tu privacidad. Esta política explica qué información recopilamos, cómo la usamos y protegemos, y qué opciones tienes. Al usar la App, reconoces esta política.",
      "1. Información que recopilamos\n• Cuenta: nombre de usuario y contraseña cifrada con hash (no guardamos contraseñas en texto claro).\n• Perfil: apodo, avatar, bio y género que elijas facilitar.\n• Tareas: títulos, detalles, fechas límite y estado para uso local y sincronización en la nube.\n• Registros técnicos: registros operativos limitados (p. ej. tiempos de solicitud, códigos de error) para la fiabilidad. No recopilamos identificadores publicitarios para anuncios ni vendemos tus datos personales a anunciantes.",
      "2. Cómo usamos la información\n• Proporcionar inicio de sesión, gestión de perfil, sincronización, estadísticas e informes periódicos.\n• Si usas la función opcional de informes con IA, el texto de tareas que envíes puede enviarse a un proveedor tercero de modelos de lenguaje solo para generar el informe. Puedes no usar esa función.\n• Mantener la seguridad y mejorar la estabilidad (p. ej. diagnosticar fallos).\n• No usamos tus datos personales para publicidad de terceros.",
      "3. Almacenamiento, retención y eliminación\n• Los datos se almacenan en servidores que operamos y en tu dispositivo.\n• Puedes solicitar la eliminación de la cuenta en Perfil. La cuenta entra en un periodo de gracia de 30 días (borrado suave) en el que puedes iniciar sesión y restaurarla. Después eliminamos de forma permanente la cuenta y los datos en la nube relacionados, salvo obligación legal de retención.\n• También puedes editar o eliminar tareas individuales en cualquier momento.",
      "4. Compartición y divulgación\n• No vendemos tus datos personales.\n• Solo divulgamos información cuando: lo exige la ley o una autoridad competente; para proteger a usuarios o la seguridad pública; con tu consentimiento claro; o cuando activas expresamente un informe IA y transmitimos el contenido enviado al encargado con ese fin.\n• Los proveedores que nos ayudan a alojar u operar la App tratan datos solo bajo nuestras instrucciones y para esos fines.",
      "5. Menores\nLa App no está dirigida a menores de 13 años (o la edad superior que exija tu jurisdicción). No recopilamos a sabiendas sus datos. Si descubrimos que lo hemos hecho, los eliminaremos de inmediato.",
      "6. Tus derechos\n• Acceder y actualizar tu perfil; gestionar tareas.\n• Solicitar eliminación de cuenta y restaurar dentro del periodo de gracia.\n• Cuando la ley aplicable lo permita (p. ej. RGPD), puedes tener derechos de acceso, rectificación, supresión, limitación, oposición o reclamación ante una autoridad. Contáctanos para ejercerlos.",
      "7. Transferencias internacionales\nServidores o encargados pueden estar en otros países. Cuando haya transferencias, adoptamos salvaguardas razonables. El uso continuado implica que comprendes que pueden ocurrir.",
      "8. Contacto\nPreguntas sobre esta política: {email}, o comentarios en la app. Si se publica una copia web pública, coincidirá con el texto en la app de la misma fecha de versión."
    ]
  },
  "terms": {
    "title": "Términos de uso",
    "updated": "Última actualización: 2026-08-04",
    "paragraphs": [
      "Lee estos Términos antes de usar Upgrade. Al registrarte o usar la App, aceptas estos Términos y la Política de privacidad. Si no estás de acuerdo, no uses la App.",
      "1. Servicio\nUpgrade ofrece gestión personal de tareas, sincronización en la nube, estadísticas e informes periódicos. Podemos mejorar o cambiar funciones y comunicaremos cambios materiales de forma razonable. Algunas capacidades (informes IA) dependen de terceros y pueden no estar disponibles.",
      "2. Cuentas y uso aceptable\n• Protege tus credenciales; eres responsable de la actividad de tu cuenta.\n• No uses el servicio con fines ilícitos, lesivos o para atacar o interrumpir el sistema.\n• Puedes solicitar la eliminación en Perfil. El borrado suave se puede cancelar en 30 días; después es permanente.",
      "3. Contenido y PI\n• Conservas los derechos sobre tu contenido y nos otorgas los derechos de tratamiento limitados necesarios para el servicio (almacenamiento, sync e informes que solicites).\n• Marcas, interfaz y código pertenecen al desarrollador o licenciantes. Salvo lo permitido por ley, no copies, hagas ingeniería inversa ni redistribuyas la App.",
      "4. Descargo\nEn la medida permitida por la ley, el servicio se ofrece «tal cual». Ayudaremos razonablemente ante interrupciones por fuerza mayor, redes, dispositivos o terceros, sin garantías más allá de la ley. El contenido generado por IA es solo de referencia y no es asesoramiento profesional.",
      "5. Cambios y terminación\nPodemos actualizar estos Términos; el uso posterior implica aceptación. Podemos limitar o terminar el acceso por infracciones graves.",
      "6. Ley aplicable\nSi una cláusula entra en conflicto con ley imperativa, prevalece esa ley y el resto sigue vigente. Los disputas deben resolverse primero de forma amistosa; de lo contrario, ante tribunales del domicilio del desarrollador, salvo disposición legal en contrario.",
      "7. Contacto\nPreguntas sobre estos Términos: {email}."
    ]
  }
};
locales["pt"] = {
  "privacy": {
    "title": "Política de privacidade",
    "updated": "Última atualização: 2026-08-04",
    "paragraphs": [
      "Bem-vindo ao Upgrade (o “App”). Respeitamos a sua privacidade. Esta política explica que informações recolhemos, como as usamos e protegemos, e as suas opções. Ao usar o App, reconhece esta política.",
      "1. Informações que recolhemos\n• Conta: nome de utilizador e palavra-passe com hash (não guardamos palavras-passe em texto simples).\n• Perfil: alcunha, avatar, bio e género que optar por fornecer.\n• Tarefas: títulos, detalhes, prazos e estado para uso local e sincronização na nuvem.\n• Registos técnicos: registos operacionais limitados (ex. tempos de pedido, códigos de erro) para fiabilidade. Não recolhemos identificadores publicitários para anúncios nem vendemos os seus dados pessoais a anunciantes.",
      "2. Como usamos as informações\n• Fornecer início de sessão, gestão de perfil, sincronização, estatísticas e relatórios periódicos.\n• Se usar a função opcional de relatório com IA, o texto de tarefas que enviar pode ser enviado a um fornecedor terceiro de modelos de linguagem apenas para gerar o relatório. Pode optar por não usar essa função.\n• Manter a segurança e melhorar a estabilidade (ex. diagnosticar falhas).\n• Não usamos os seus dados pessoais para publicidade de terceiros.",
      "3. Armazenamento, retenção e eliminação\n• Os dados são armazenados nos servidores que operamos e no seu dispositivo.\n• Pode pedir a eliminação da conta em Perfil. A conta entra num período de graça de 30 dias (eliminação suave) em que pode iniciar sessão e restaurá-la. Depois eliminamos permanentemente a conta e os dados na nuvem relacionados, salvo obrigação legal de retenção.\n• Também pode editar ou eliminar tarefas individuais a qualquer momento.",
      "4. Partilha e divulgação\n• Não vendemos os seus dados pessoais.\n• Só divulgamos informação quando: a lei ou autoridade competente o exigir; para proteger utilizadores ou a segurança pública; com o seu consentimento claro; ou quando ativa expressamente um relatório IA e transmitimos o conteúdo submetido ao processador para esse fim.\n• Prestadores que nos ajudam a alojar ou operar o App tratam dados apenas segundo as nossas instruções e para esses fins.",
      "5. Crianças\nO App não se destina a crianças com menos de 13 anos (ou idade superior exigida na sua jurisdição). Não recolhemos intencionalmente os seus dados. Se soubermos que o fizemos, eliminá-los-emos de imediato.",
      "6. Os seus direitos\n• Aceder e atualizar o perfil; gerir tarefas.\n• Pedir eliminação da conta e restaurar no período de graça.\n• Quando a lei aplicável o prever (ex. RGPD), pode ter direitos de acesso, retificação, apagamento, limitação, oposição ou reclamação junto de uma autoridade. Contacte-nos para os exercer.",
      "7. Transferências internacionais\nServidores ou processadores podem estar noutros países. Quando houver transferências, adotamos salvaguardas razoáveis. O uso continuado significa que compreende que tais transferências podem ocorrer.",
      "8. Contacto\nQuestões sobre esta política: {email}, ou feedback na app. Se for publicada uma cópia web pública, corresponderá ao texto na app da mesma data de versão."
    ]
  },
  "terms": {
    "title": "Termos de utilização",
    "updated": "Última atualização: 2026-08-04",
    "paragraphs": [
      "Leia estes Termos antes de usar o Upgrade. Ao registar-se ou usar o App, aceita estes Termos e a Política de privacidade. Se não concordar, não use o App.",
      "1. Serviço\nO Upgrade oferece gestão pessoal de tarefas, sincronização na nuvem, estatísticas e relatórios periódicos. Podemos melhorar ou alterar funcionalidades e comunicaremos alterações materiais de forma razoável. Algumas capacidades (relatórios IA) dependem de terceiros e podem ficar indisponíveis.",
      "2. Contas e uso aceitável\n• Proteja as credenciais; é responsável pela atividade da conta.\n• Não use o serviço para fins ilícitos, lesivos ou para atacar ou perturbar o sistema.\n• Pode pedir eliminação em Perfil. A eliminação suave pode ser cancelada em 30 dias; depois é permanente.",
      "3. Conteúdo e PI\n• Mantém os direitos sobre o conteúdo que cria e concede-nos os direitos de tratamento limitados necessários ao serviço (armazenamento, sync e relatórios que solicitar).\n• Marcas, interface e código pertencem ao programador ou licenciantes. Salvo o permitido por lei, não copie, faça engenharia inversa nem redistribua o App.",
      "4. Aviso de isenção\nNa medida permitida pela lei, o serviço é fornecido “tal como está”. Ajudaremos razoavelmente em interrupções por força maior, redes, dispositivos ou terceiros, sem garantias além da lei. Conteúdo gerado por IA é apenas de referência e não é aconselhamento profissional.",
      "5. Alterações e cessação\nPodemos atualizar estes Termos; o uso após a atualização implica aceitação. Podemos limitar ou terminar o acesso por violações graves.",
      "6. Lei aplicável\nSe uma cláusula conflitar com lei imperativa, prevalece essa lei e o resto permanece. Os litígios devem resolver-se primeiro amigavelmente; caso contrário, nos tribunais do local do programador, salvo disposição legal em contrário.",
      "7. Contacto\nQuestões sobre estes Termos: {email}."
    ]
  }
};
locales["it"] = {
  "privacy": {
    "title": "Informativa sulla privacy",
    "updated": "Ultimo aggiornamento: 2026-08-04",
    "paragraphs": [
      "Benvenuto in Upgrade (l’“App”). Rispettiamo la tua privacy. Questa informativa spiega quali dati raccogliamo, come li usiamo e proteggiamo e quali scelte hai. Usando l’App riconosci questa informativa.",
      "1. Dati che raccogliamo\n• Account: nome utente e password con hash (non memorizziamo password in chiaro).\n• Profilo: nickname, avatar, bio e genere che scegli di fornire.\n• Attività: titoli, dettagli, scadenze e stato per uso locale e sync cloud.\n• Log tecnici: log operativi limitati (es. tempi di richiesta, codici di errore) per l’affidabilità. Non raccogliamo identificatori pubblicitari per gli annunci e non vendiamo i tuoi dati personali agli inserzionisti.",
      "2. Come usiamo i dati\n• Fornire accesso, gestione profilo, sync, statistiche e report periodici.\n• Se usi la funzione opzionale di report IA, il testo delle attività che invii può essere inviato a un fornitore terzo di modelli linguistici solo per generare il report. Puoi non usare tale funzione.\n• Mantenere sicurezza e stabilità (es. diagnosi di guasti).\n• Non usiamo i tuoi dati personali per pubblicità di terzi.",
      "3. Conservazione ed eliminazione\n• I dati sono conservati sui server che gestiamo e sul tuo dispositivo.\n• Puoi richiedere l’eliminazione dell’account in Profilo. L’account entra in un periodo di grazia di 30 giorni (soft-delete) in cui puoi accedere e ripristinarlo. Poi eliminiamo definitivamente account e dati cloud correlati, salvo obblighi di legge.\n• Puoi anche modificare o eliminare singole attività in qualsiasi momento.",
      "4. Condivisione\n• Non vendiamo i tuoi dati personali.\n• Divulghiamo informazioni solo se: richiesto dalla legge o da autorità; per proteggere utenti o sicurezza pubblica; con consenso chiaro; o quando attivi esplicitamente un report IA e trasmettiamo il contenuto inviato al responsabile per tale scopo.\n• I fornitori che ci aiutano a ospitare o gestire l’App trattano i dati solo secondo le nostre istruzioni e per tali fini.",
      "5. Minori\nL’App non è rivolta a minori di 13 anni (o età superiore richiesta nella tua giurisdizione). Non raccogliamo consapevolmente i loro dati. Se lo scopriamo, li elimineremo tempestivamente.",
      "6. I tuoi diritti\n• Accedere e aggiornare il profilo; gestire le attività.\n• Richiedere eliminazione e ripristino nel periodo di grazia.\n• Ove previsto dalla legge applicabile (es. GDPR), puoi avere diritti di accesso, rettifica, cancellazione, limitazione, opposizione o reclamo a un’autorità. Contattaci per esercitarli.",
      "7. Trasferimenti internazionali\nServer o responsabili possono trovarsi in altri Paesi. In caso di trasferimenti adottiamo salvaguardie ragionevoli. L’uso continuato implica che comprendi che tali trasferimenti possono avvenire.",
      "8. Contatti\nDomande su questa informativa: {email}, o feedback in-app. Se viene pubblicata una copia web pubblica, corrisponderà al testo in-app della stessa data di versione."
    ]
  },
  "terms": {
    "title": "Termini di utilizzo",
    "updated": "Ultimo aggiornamento: 2026-08-04",
    "paragraphs": [
      "Leggi questi Termini prima di usare Upgrade. Registrandoti o usando l’App accetti questi Termini e l’Informativa sulla privacy. Se non sei d’accordo, non usare l’App.",
      "1. Servizio\nUpgrade offre gestione personale delle attività, sync cloud, statistiche e report periodici. Possiamo migliorare o modificare le funzioni e comunicheremo i cambiamenti rilevanti in modo ragionevole. Alcune capacità (report IA) dipendono da terzi e possono essere indisponibili.",
      "2. Account e uso lecito\n• Custodisci le credenziali; sei responsabile dell’attività del tuo account.\n• Non usare il servizio per scopi illeciti, lesivi o per attaccare o disturbare il sistema.\n• Puoi richiedere l’eliminazione in Profilo. Il soft-delete può essere annullato entro 30 giorni; poi è permanente.",
      "3. Contenuti e IP\n• Conservi i diritti sui contenuti che crei e ci concedi i diritti di trattamento limitati necessari al servizio (archiviazione, sync e report richiesti).\n• Marchi, interfaccia e codice appartengono allo sviluppatore o ai licenzianti. Salvo quanto consentito dalla legge, non copiare, fare reverse engineering o ridistribuire l’App.",
      "4. Disclaimer\nNella misura consentita dalla legge, il servizio è fornito “così com’è”. Aiuteremo ragionevolmente in caso di interruzioni da forza maggiore, reti, dispositivi o terzi, senza garanzie oltre la legge. I contenuti generati dall’IA sono solo di riferimento e non costituiscono consulenza professionale.",
      "5. Modifiche e cessazione\nPossiamo aggiornare questi Termini; l’uso successivo implica accettazione. Possiamo limitare o cessare l’accesso per gravi violazioni.",
      "6. Legge applicabile\nSe una clausola confligge con norma imperativa, prevale quest’ultima e il resto resta valido. Le controversie vanno prima risolte amichevolmente; altrimenti presso i tribunali del luogo dello sviluppatore, salvo diversa norma imperativa.",
      "7. Contatti\nDomande su questi Termini: {email}."
    ]
  }
};
locales["ru"] = {
  "privacy": {
    "title": "Политика конфиденциальности",
    "updated": "Последнее обновление: 2026-08-04",
    "paragraphs": [
      "Добро пожаловать в Upgrade («Приложение»). Мы уважаем вашу конфиденциальность. Эта политика объясняет, какие данные мы собираем, как используем и защищаем их, и какие у вас есть возможности. Используя Приложение, вы подтверждаете ознакомление с этой политикой.",
      "1. Какие данные мы собираем\n• Аккаунт: имя пользователя и хеш пароля (пароли в открытом виде не храним).\n• Профиль: никнейм, аватар, описание и пол, которые вы указываете.\n• Задачи: названия, детали, сроки и статус для локального использования и облачной синхронизации.\n• Технические журналы: ограниченные операционные логи (например, время запросов, коды ошибок) для стабильности. Мы не собираем рекламные идентификаторы для рекламы и не продаём персональные данные рекламодателям.",
      "2. Как мы используем данные\n• Предоставление входа, управления профилем, синхронизации, статистики и периодических отчётов.\n• Если вы используете опциональную функцию ИИ-отчётов, связанный текст задач, который вы отправляете, может быть передан стороннему провайдеру большой языковой модели только для генерации отчёта. Вы можете не использовать эту функцию.\n• Поддержание безопасности и стабильности (например, диагностика сбоев).\n• Мы не используем персональные данные для сторонней рекламы.",
      "3. Хранение, срок и удаление\n• Данные хранятся на наших серверах и на вашем устройстве.\n• Удаление аккаунта можно запросить в Профиле. Аккаунт переходит в 30-дневный период мягкого удаления, в течение которого можно войти и восстановить его. После этого мы безвозвратно удаляем аккаунт и связанные облачные данные, кроме случаев, когда закон требует хранения.\n• Отдельные задачи можно редактировать или удалять в любое время.",
      "4. Передача и раскрытие\n• Мы не продаём персональные данные.\n• Раскрываем информацию только когда: требуется законом или уполномоченным органом; для защиты пользователей или общественной безопасности; при вашем явном согласии; или когда вы явно запускаете ИИ-отчёт и мы передаём отправленный контент обработчику для этой цели.\n• Поставщики, помогающие нам размещать или эксплуатировать Приложение, обрабатывают данные только по нашим указаниям и для этих целей.",
      "5. Дети\nПриложение не предназначено для детей младше 13 лет (или более высокого возраста, требуемого в вашей юрисдикции). Мы сознательно не собираем их данные. Если узнаем о сборе — оперативно удалим.",
      "6. Ваши права\n• Доступ и обновление профиля; управление задачами.\n• Запрос удаления аккаунта и восстановление в период отсрочки.\n• Там, где применимое право (например, GDPR) предоставляет права на доступ, исправление, удаление, ограничение, возражение или жалобу в надзорный орган, свяжитесь с нами для их реализации.",
      "7. Международные передачи\nСерверы или обработчики могут находиться в других странах. При передачах мы принимаем разумные меры защиты. Продолжение использования означает, что вы понимаете возможность таких передач.",
      "8. Контакты\nВопросы по этой политике: {email} или обратная связь в приложении. Публичная веб-копия (если опубликована) соответствует тексту в приложении той же даты версии."
    ]
  },
  "terms": {
    "title": "Условия использования",
    "updated": "Последнее обновление: 2026-08-04",
    "paragraphs": [
      "Перед использованием Upgrade прочитайте эти Условия. Регистрируясь или используя Приложение, вы соглашаетесь с этими Условиями и Политикой конфиденциальности. Если не согласны — не используйте Приложение.",
      "1. Сервис\nUpgrade предоставляет личное управление задачами, облачную синхронизацию, статистику и периодические отчёты. Мы можем улучшать или менять функции и разумно уведомим о существенных изменениях. Некоторые возможности (ИИ-отчёты) зависят от сторонних сервисов и могут быть недоступны.",
      "2. Аккаунты и допустимое использование\n• Храните учётные данные в безопасности; вы отвечаете за действия в аккаунте.\n• Не используйте сервис в незаконных, нарушающих права или вредоносных целях и не атакуйте систему.\n• Удаление можно запросить в Профиле. Мягкое удаление можно отменить в течение 30 дней; затем оно окончательно.",
      "3. Контент и ИС\n• Вы сохраняете права на создаваемый контент и предоставляете нам ограниченные права обработки, необходимые для сервиса (хранение, sync и запрошенные отчёты).\n• Товарные знаки, интерфейс и код принадлежат разработчику или лицензиарам. Кроме случаев, разрешённых законом, нельзя копировать, проводить обратную разработку или распространять Приложение.",
      "4. Отказ от гарантий\nВ пределах, допускаемых законом, сервис предоставляется «как есть». Мы разумно поможем при сбоях из‑за непреодолимой силы, сетей, устройств или сторонних сервисов, но не даём гарантий сверх закона. Контент ИИ — только для справки и не является профессиональной консультацией.",
      "5. Изменения и прекращение\nМы можем обновлять эти Условия; дальнейшее использование означает принятие. При серьёзных нарушениях мы можем ограничить или прекратить доступ.",
      "6. Применимое право\nПри конфликте с императивной нормой действует она; остальные условия сохраняются. Споры сначала решаются мирно; иначе — в судах по месту нахождения разработчика, если императивное право не требует иного.",
      "7. Контакты\nВопросы по этим Условиям: {email}."
    ]
  }
};
locales["vi"] = {
  "privacy": {
    "title": "Chính sách quyền riêng tư",
    "updated": "Cập nhật lần cuối: 2026-08-04",
    "paragraphs": [
      "Chào mừng bạn đến với Upgrade (“Ứng dụng”). Chúng tôi tôn trọng quyền riêng tư của bạn. Chính sách này giải thích thông tin chúng tôi thu thập, cách sử dụng và bảo vệ, cũng như các lựa chọn của bạn. Việc sử dụng Ứng dụng đồng nghĩa với việc bạn đã đọc chính sách này.",
      "1. Thông tin chúng tôi thu thập\n• Tài khoản: tên người dùng và mật khẩu đã băm (không lưu mật khẩu dạng rõ).\n• Hồ sơ: biệt danh, ảnh đại diện, tiểu sử và giới tính bạn chọn cung cấp.\n• Dữ liệu việc: tiêu đề, chi tiết, hạn và trạng thái hoàn thành để dùng trên thiết bị và đồng bộ đám mây.\n• Nhật ký kỹ thuật: nhật ký vận hành hạn chế (ví dụ thời gian yêu cầu, mã lỗi) để đảm bảo ổn định. Chúng tôi không thu thập mã định danh quảng cáo cho quảng cáo và không bán thông tin cá nhân cho nhà quảng cáo.",
      "2. Cách chúng tôi sử dụng thông tin\n• Cung cấp đăng nhập, quản lý hồ sơ, đồng bộ việc, thống kê và báo cáo theo kỳ.\n• Nếu bạn dùng tính năng báo cáo AI tùy chọn, văn bản việc bạn chọn gửi có thể được gửi tới nhà cung cấp mô hình ngôn ngữ lớn bên thứ ba chỉ để tạo báo cáo. Bạn có thể không dùng tính năng đó.\n• Duy trì bảo mật và cải thiện ổn định (ví dụ chẩn đoán sự cố).\n• Chúng tôi không dùng thông tin cá nhân cho quảng cáo bên thứ ba.",
      "3. Lưu trữ, lưu giữ và xóa\n• Dữ liệu được lưu trên máy chủ chúng tôi vận hành và trên thiết bị của bạn.\n• Bạn có thể yêu cầu xóa tài khoản trong Hồ sơ. Tài khoản vào giai đoạn xóa mềm 30 ngày, trong đó bạn có thể đăng nhập và khôi phục. Sau đó chúng tôi xóa vĩnh viễn tài khoản và dữ liệu đám mây liên quan, trừ khi pháp luật yêu cầu lưu giữ.\n• Bạn cũng có thể sửa hoặc xóa từng việc bất cứ lúc nào.",
      "4. Chia sẻ và tiết lộ\n• Chúng tôi không bán thông tin cá nhân.\n• Chỉ tiết lộ khi: pháp luật hoặc cơ quan có thẩm quyền yêu cầu; bảo vệ người dùng hoặc an toàn công cộng; có sự đồng ý rõ ràng của bạn; hoặc bạn chủ động kích hoạt báo cáo AI và chúng tôi truyền nội dung bạn gửi tới bên xử lý cho mục đích đó.\n• Nhà cung cấp hỗ trợ lưu trữ/vận hành chỉ xử lý dữ liệu theo chỉ thị của chúng tôi và cho các mục đích đó.",
      "5. Trẻ em\nỨng dụng không hướng tới trẻ em dưới 13 tuổi (hoặc độ tuổi cao hơn theo khu vực pháp lý của bạn). Chúng tôi không cố ý thu thập thông tin của các em. Nếu phát hiện đã thu thập, chúng tôi sẽ xóa ngay.",
      "6. Quyền của bạn\n• Truy cập và cập nhật hồ sơ; quản lý việc.\n• Yêu cầu xóa tài khoản và khôi phục trong thời gian ân hạn.\n• Khi luật áp dụng (ví dụ GDPR) cho phép, bạn có thể có quyền truy cập, sửa, xóa, hạn chế xử lý, phản đối hoặc khiếu nại với cơ quan giám sát. Liên hệ chúng tôi để thực hiện.",
      "7. Chuyển dữ liệu quốc tế\nMáy chủ hoặc bên xử lý có thể ở quốc gia khác. Khi có chuyển giao, chúng tôi áp dụng biện pháp bảo vệ hợp lý. Tiếp tục sử dụng nghĩa là bạn hiểu việc chuyển giao có thể xảy ra.",
      "8. Liên hệ\nCâu hỏi về chính sách này: {email}, hoặc phản hồi trong ứng dụng. Bản web công khai (nếu có) sẽ khớp văn bản trong ứng dụng cùng ngày phiên bản."
    ]
  },
  "terms": {
    "title": "Điều khoản sử dụng",
    "updated": "Cập nhật lần cuối: 2026-08-04",
    "paragraphs": [
      "Vui lòng đọc các Điều khoản này trước khi dùng Upgrade. Đăng ký hoặc sử dụng Ứng dụng nghĩa là bạn đồng ý với các Điều khoản và Chính sách quyền riêng tư. Nếu không đồng ý, đừng dùng Ứng dụng.",
      "1. Dịch vụ\nUpgrade cung cấp quản lý việc cá nhân, đồng bộ đám mây, thống kê và báo cáo theo kỳ. Chúng tôi có thể cải thiện hoặc thay đổi tính năng và sẽ thông báo thay đổi quan trọng một cách hợp lý. Một số khả năng (báo cáo AI) phụ thuộc bên thứ ba và có thể tạm thời không khả dụng.",
      "2. Tài khoản và sử dụng hợp lệ\n• Bảo mật thông tin đăng nhập; bạn chịu trách nhiệm hoạt động trên tài khoản.\n• Không dùng dịch vụ cho mục đích bất hợp pháp, xâm phạm hoặc gây hại, hay tấn công/gây rối hệ thống.\n• Có thể yêu cầu xóa trong Hồ sơ. Xóa mềm có thể hủy trong 30 ngày; sau đó là vĩnh viễn.",
      "3. Nội dung và sở hữu trí tuệ\n• Bạn giữ quyền với nội dung mình tạo và cấp cho chúng tôi quyền xử lý hạn chế cần thiết để vận hành dịch vụ (lưu trữ, đồng bộ và báo cáo bạn yêu cầu).\n• Thương hiệu, giao diện và mã thuộc nhà phát triển hoặc bên cấp phép. Trừ khi luật cho phép, không sao chép, dịch ngược hoặc phân phối lại Ứng dụng.",
      "4. Tuyên bố miễn trừ\nTrong phạm vi luật cho phép, dịch vụ được cung cấp “nguyên trạng”. Chúng tôi sẽ hỗ trợ hợp lý khi gián đoạn do bất khả kháng, mạng, thiết bị hoặc bên thứ ba, nhưng không bảo đảm vượt quá luật. Nội dung AI chỉ mang tính tham khảo, không phải tư vấn chuyên môn.",
      "5. Thay đổi và chấm dứt\nChúng tôi có thể cập nhật Điều khoản; tiếp tục dùng sau cập nhật nghĩa là chấp nhận. Có thể hạn chế hoặc chấm dứt truy cập nếu vi phạm nghiêm trọng.",
      "6. Luật áp dụng\nNếu điều khoản xung đột với luật bắt buộc, luật đó được ưu tiên; phần còn lại vẫn hiệu lực. Tranh chấp nên giải quyết thân thiện trước; nếu không, có thể đưa ra tòa có thẩm quyền nơi nhà phát triển đặt trụ sở, trừ khi luật bắt buộc khác.",
      "7. Liên hệ\nCâu hỏi về Điều khoản: {email}."
    ]
  }
};
locales["th"] = {
  "privacy": {
    "title": "นโยบายความเป็นส่วนตัว",
    "updated": "อัปเดตล่าสุด: 2026-08-04",
    "paragraphs": [
      "ยินดีต้อนรับสู่ Upgrade (“แอป”) เราเคารพความเป็นส่วนตัวของคุณ นโยบายนี้อธิบายข้อมูลที่เรารวบรวม วิธีใช้และปกป้อง และตัวเลือกของคุณ การใช้แอปถือว่าคุณรับทราบนโยบายนี้",
      "1. ข้อมูลที่เรารวบรวม\n• บัญชี: ชื่อผู้ใช้และรหัสผ่านที่แฮชแล้ว (ไม่เก็บรหัสผ่านแบบข้อความธรรมดา)\n• โปรไฟล์: ชื่อเล่น อวาตาร์ คำแนะนำ และเพศที่คุณเลือกให้\n• ข้อมูลงาน: ชื่อ รายละเอียด วันครบกำหนด และสถานะ สำหรับใช้บนอุปกรณ์และซิงก์คลาวด์\n• บันทึกทางเทคนิค: บันทึกการทำงานที่จำกัด (เช่น เวลาคำขอ รหัสข้อผิดพลาด) เพื่อความเสถียร เราไม่รวบรวมตัวระบุโฆษณาเพื่อโฆษณา และไม่ขายข้อมูลส่วนบุคคลให้ผู้ลงโฆษณา",
      "2. วิธีที่เราใช้ข้อมูล\n• ให้บริการเข้าสู่ระบบ จัดการโปรไฟล์ ซิงก์งาน สถิติ และรายงานตามช่วงเวลา\n• หากคุณใช้ฟีเจอร์รายงาน AI แบบเลือกได้ ข้อความงานที่คุณส่งอาจถูกส่งไปยังผู้ให้บริการโมเดลภาษาขนาดใหญ่ของบุคคลที่สามเพื่อสร้างรายงานเท่านั้น คุณเลือกไม่ใช้ฟีเจอร์นั้นได้\n• รักษาความปลอดภัยและปรับปรุงเสถียรภาพ (เช่น วิเคราะห์ข้อขัดข้อง)\n• เราไม่ใช้ข้อมูลส่วนบุคคลเพื่อโฆษณาของบุคคลที่สาม",
      "3. การจัดเก็บ การเก็บรักษา และการลบ\n• ข้อมูลถูกเก็บบนเซิร์ฟเวอร์ที่เราดูแลและบนอุปกรณ์ของคุณ\n• คุณขอลบบัญชีได้ในโปรไฟล์ บัญชีจะเข้าสู่ระยะผ่อนผันการลบแบบอ่อน 30 วัน ซึ่งคุณสามารถเข้าสู่ระบบและกู้คืนได้ หลังจากนั้นเราจะลบบัญชีและข้อมูลคลาวด์ที่เกี่ยวข้องถาวร เว้นแต่กฎหมายกำหนดให้เก็บไว้\n• คุณแก้ไขหรือลบงานแต่ละรายการได้ตลอดเวลา",
      "4. การแบ่งปันและการเปิดเผย\n• เราไม่ขายข้อมูลส่วนบุคคลของคุณ\n• เปิดเผยเฉพาะเมื่อ: กฎหมายหรือหน่วยงานที่มีอำนาจร้องขอ; เพื่อปกป้องผู้ใช้หรือความปลอดภัยสาธารณะ; ด้วยความยินยอมชัดเจนของคุณ; หรือเมื่อคุณเปิดใช้รายงาน AI อย่างชัดเจนและเราส่งเนื้อหาที่คุณส่งไปยังผู้ประมวลผลเพื่อวัตถุประสงค์นั้น\n• ผู้ให้บริการที่ช่วยโฮสต์หรือดำเนินงานจะประมวลผลข้อมูลตามคำสั่งของเราและเพื่อวัตถุประสงค์เหล่านั้นเท่านั้น",
      "5. เด็ก\nแอปไม่ได้มุ่งเป้าไปที่เด็กอายุต่ำกว่า 13 ปี (หรืออายุที่สูงกว่าตามเขตอำนาจของคุณ) เราไม่เจตนาเก็บข้อมูลของเด็กดังกล่าว หากพบว่าได้เก็บไว้ เราจะลบทันที",
      "6. สิทธิของคุณ\n• เข้าถึงและอัปเดตโปรไฟล์; จัดการงาน\n• ขอลบบัญชีและกู้คืนในช่วงผ่อนผัน\n• เมื่อกฎหมายที่ใช้บังคับ (เช่น GDPR) ให้สิทธิ์ คุณอาจมีสิทธิ์เข้าถึง แก้ไข ลบ จำกัดการประมวลผล คัดค้าน หรือร้องเรียนต่อหน่วยงานกำกับดูแล ติดต่อเราเพื่อใช้สิทธิ์",
      "7. การโอนระหว่างประเทศ\nเซิร์ฟเวอร์หรือผู้ประมวลผลอาจอยู่ในประเทศอื่น เมื่อมีการโอน เราใช้มาตรการคุ้มครองที่เหมาะสม การใช้ต่อเนื่องหมายความว่าคุณเข้าใจว่าอาจมีการโอนดังกล่าว",
      "8. ติดต่อ\nคำถามเกี่ยวกับนโยบายนี้: {email} หรือความคิดเห็นในแอป หากมีฉบับเว็บสาธารณะ จะตรงกับข้อความในแอปของวันที่เวอร์ชันเดียวกัน"
    ]
  },
  "terms": {
    "title": "ข้อกำหนดการใช้งาน",
    "updated": "อัปเดตล่าสุด: 2026-08-04",
    "paragraphs": [
      "โปรดอ่านข้อกำหนดเหล่านี้ก่อนใช้ Upgrade การลงทะเบียนหรือใช้แอปถือว่าคุณยอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว หากไม่ยอมรับ โปรดอย่าใช้แอป",
      "1. บริการ\nUpgrade ให้บริการจัดการงานส่วนบุคคล ซิงก์คลาวด์ สถิติ และรายงานตามช่วงเวลา เราอาจปรับปรุงหรือเปลี่ยนฟีเจอร์ และจะแจ้งการเปลี่ยนแปลงสำคัญอย่างสมเหตุสมผล ความสามารถบางอย่าง (รายงาน AI) พึ่งพาบุคคลที่สามและอาจใช้ไม่ได้ชั่วคราว",
      "2. บัญชีและการใช้งานที่ยอมรับได้\n• รักษาข้อมูลเข้าสู่ระบบให้ปลอดภัย คุณรับผิดชอบกิจกรรมภายใต้บัญชี\n• ห้ามใช้บริการเพื่อวัตถุประสงค์ผิดกฎหมาย ละเมิด หรือเป็นอันตราย หรือโจมตี/รบกวนระบบ\n• ขอลบได้ในโปรไฟล์ การลบแบบอ่อนยกเลิกได้ภายใน 30 วัน จากนั้นถาวร",
      "3. เนื้อหาและทรัพย์สินทางปัญญา\n• คุณยังคงมีสิทธิ์ในเนื้อหาที่สร้าง และมอบสิทธิ์การประมวลผลจำกัดที่จำเป็นให้เรา (จัดเก็บ ซิงก์ และรายงานที่คุณขอ)\n• เครื่องหมาย การ์ดอินเทอร์เฟซ และโค้ดเป็นของนักพัฒนาหรือผู้ให้อนุญาต เว้นแต่กฎหมายอนุญาต ห้ามคัดลอก ย้อนวิศวกรรม หรือแจกจ่ายแอปต่อ",
      "4. ข้อจำกัดความรับผิด\nในขอบเขตที่กฎหมายอนุญาต บริการให้ “ตามสภาพ” เราจะช่วยเหลืออย่างสมเหตุสมผลเมื่อเกิดเหตุขัดข้องจากเหตุสุดวิสัย เครือข่าย อุปกรณ์ หรือบุคคลที่สาม แต่ไม่รับประกันเกินกว่าที่กฎหมายกำหนด เนื้อหา AI เป็นเพียงข้อมูลอ้างอิง ไม่ใช่คำแนะนำมืออาชีพ",
      "5. การเปลี่ยนแปลงและการสิ้นสุด\nเราอาจอัปเดตข้อกำหนด การใช้ต่อหลังอัปเดตถือว่ายอมรับ เราอาจจำกัดหรือยุติการเข้าถึงหากละเมิดร้ายแรง",
      "6. กฎหมายที่ใช้บังคับ\nหากข้อกำหนดขัดกับกฎหมายบังคับ ให้กฎหมายนั้นมีผลเหนือกว่า ส่วนที่เหลือยังใช้ได้ ข้อพิพาทควรเจรจาโดยดีก่อน มิฉะนั้นอาจยื่นต่อศาลที่มีอำนาจ ณ ที่ตั้งของนักพัฒนา เว้นแต่กฎหมายบังคับกำหนดเป็นอย่างอื่น",
      "7. ติดต่อ\nคำถามเกี่ยวกับข้อกำหนด: {email}."
    ]
  }
};
locales["id"] = {
  "privacy": {
    "title": "Kebijakan privasi",
    "updated": "Terakhir diperbarui: 2026-08-04",
    "paragraphs": [
      "Selamat datang di Upgrade (“Aplikasi”). Kami menghormati privasi Anda. Kebijakan ini menjelaskan informasi yang kami kumpulkan, cara kami menggunakan dan melindunginya, serta pilihan Anda. Dengan menggunakan Aplikasi, Anda mengakui kebijakan ini.",
      "1. Informasi yang kami kumpulkan\n• Akun: nama pengguna dan kata sandi yang di-hash (kami tidak menyimpan kata sandi teks biasa).\n• Profil: nama panggilan, avatar, bio, dan gender yang Anda pilih untuk diberikan.\n• Data tugas: judul, detail, jatuh tempo, dan status untuk penggunaan lokal serta sinkronisasi cloud.\n• Log teknis: log operasional terbatas (mis. waktu permintaan, kode error) demi keandalan. Kami tidak mengumpulkan pengenal iklan untuk iklan dan tidak menjual informasi pribadi kepada pengiklan.",
      "2. Cara kami menggunakan informasi\n• Menyediakan masuk, pengelolaan profil, sinkronisasi, statistik, dan laporan berkala.\n• Jika Anda menggunakan fitur laporan AI opsional, teks tugas yang Anda kirim dapat dikirim ke penyedia model bahasa besar pihak ketiga hanya untuk menghasilkan laporan. Anda dapat memilih untuk tidak menggunakan fitur itu.\n• Menjaga keamanan dan meningkatkan stabilitas (mis. mendiagnosis kegagalan).\n• Kami tidak menggunakan informasi pribadi Anda untuk iklan pihak ketiga.",
      "3. Penyimpanan, retensi, dan penghapusan\n• Data disimpan di server yang kami operasikan dan di perangkat Anda.\n• Anda dapat meminta penghapusan akun di Profil. Akun memasuki masa tenggang soft-delete 30 hari saat Anda dapat masuk dan memulihkannya. Setelah itu kami menghapus permanen akun dan data cloud terkait, kecuali hukum mewajibkan retensi.\n• Anda juga dapat mengedit atau menghapus tugas individu kapan saja.",
      "4. Berbagi dan pengungkapan\n• Kami tidak menjual informasi pribadi Anda.\n• Kami hanya mengungkapkan informasi jika: diwajibkan hukum atau otoritas berwenang; untuk melindungi pengguna atau keselamatan publik; dengan persetujuan jelas Anda; atau ketika Anda secara eksplisit memicu laporan AI dan kami mengirimkan konten yang Anda kirim ke pemroses untuk tujuan itu.\n• Penyedia yang membantu hosting atau pengoperasian memproses data hanya sesuai instruksi kami dan untuk tujuan tersebut.",
      "5. Anak-anak\nAplikasi tidak ditujukan untuk anak di bawah 13 tahun (atau usia lebih tinggi yang diwajibkan di yurisdiksi Anda). Kami tidak sengaja mengumpulkan data mereka. Jika kami mengetahuinya, kami akan segera menghapusnya.",
      "6. Hak Anda\n• Mengakses dan memperbarui profil; mengelola tugas.\n• Meminta penghapusan akun dan memulihkan dalam masa tenggang.\n• Jika hukum yang berlaku (mis. GDPR) memberikan hak, Anda mungkin memiliki hak akses, koreksi, penghapusan, pembatasan, keberatan, atau mengajukan keluhan ke otoritas. Hubungi kami untuk mengeksekusinya.",
      "7. Transfer internasional\nServer atau pemroses mungkin berada di negara lain. Jika terjadi transfer, kami mengambil perlindungan yang wajar. Penggunaan berkelanjutan berarti Anda memahami transfer tersebut mungkin terjadi.",
      "8. Kontak\nPertanyaan tentang kebijakan ini: {email}, atau umpan balik in-app. Jika salinan web publik diterbitkan, akan cocok dengan teks in-app pada tanggal versi yang sama."
    ]
  },
  "terms": {
    "title": "Syarat penggunaan",
    "updated": "Terakhir diperbarui: 2026-08-04",
    "paragraphs": [
      "Harap baca Syarat ini sebelum menggunakan Upgrade. Dengan mendaftar atau menggunakan Aplikasi, Anda menyetujui Syarat ini dan Kebijakan privasi. Jika tidak setuju, jangan gunakan Aplikasi.",
      "1. Layanan\nUpgrade menyediakan pengelolaan tugas pribadi, sinkronisasi cloud, statistik, dan laporan berkala. Kami dapat memperbaiki atau mengubah fitur dan akan mengomunikasikan perubahan material secara wajar. Beberapa kemampuan (laporan AI) bergantung pada pihak ketiga dan mungkin tidak tersedia.",
      "2. Akun dan penggunaan yang diterima\n• Amankan kredensial Anda; Anda bertanggung jawab atas aktivitas di akun.\n• Jangan gunakan layanan untuk tujuan melanggar hukum, merugikan, atau menyerang/mengganggu sistem.\n• Anda dapat meminta penghapusan di Profil. Soft-delete dapat dibatalkan dalam 30 hari; setelah itu permanen.",
      "3. Konten dan KI\n• Anda mempertahankan hak atas konten yang Anda buat dan memberi kami hak pemrosesan terbatas yang diperlukan untuk layanan (penyimpanan, sync, dan laporan yang Anda minta).\n• Merek, UI, dan kode milik pengembang atau pemberi lisensi. Kecuali diizinkan hukum, jangan menyalin, merekayasa balik, atau mendistribusikan ulang Aplikasi.",
      "4. Penafian\nSejauh diizinkan hukum, layanan disediakan “sebagaimana adanya”. Kami akan membantu secara wajar saat gangguan karena force majeure, jaringan, perangkat, atau pihak ketiga, tanpa jaminan melebihi hukum. Konten AI hanya untuk referensi dan bukan nasihat profesional.",
      "5. Perubahan dan penghentian\nKami dapat memperbarui Syarat ini; penggunaan setelah pembaruan berarti penerimaan. Kami dapat membatasi atau mengakhiri akses atas pelanggaran serius.",
      "6. Hukum yang berlaku\nJika ketentuan bertentangan dengan hukum wajib, hukum itu yang berlaku; sisanya tetap berlaku. Sengketa sebaiknya diselesaikan secara damai terlebih dahulu; jika tidak, dapat diajukan ke pengadilan di tempat kedudukan pengembang, kecuali hukum wajib menentukan lain.",
      "7. Kontak\nPertanyaan tentang Syarat ini: {email}."
    ]
  }
};
locales["ms"] = {
  "privacy": {
    "title": "Dasar privasi",
    "updated": "Kemaskini terakhir: 2026-08-04",
    "paragraphs": [
      "Selamat datang ke Upgrade (“Aplikasi”). Kami menghormati privasi anda. Dasar ini menerangkan maklumat yang kami kumpul, cara kami gunakan dan lindungi, serta pilihan anda. Dengan menggunakan Aplikasi, anda mengakui dasar ini.",
      "1. Maklumat yang kami kumpul\n• Akaun: nama pengguna dan kata laluan di-hash (kami tidak simpan kata laluan teks biasa).\n• Profil: nama panggilan, avatar, bio dan jantina yang anda pilih untuk berikan.\n• Data tugas: tajuk, butiran, tarikh akhir dan status untuk penggunaan tempatan serta segerak awan.\n• Log teknikal: log operasi terhad (cth. masa permintaan, kod ralat) untuk kebolehpercayaan. Kami tidak kumpul pengecam iklan untuk iklan dan tidak jual maklumat peribadi kepada pengiklan.",
      "2. Cara kami gunakan maklumat\n• Menyediakan log masuk, pengurusan profil, segerak, statistik dan laporan berkala.\n• Jika anda guna ciri laporan AI pilihan, teks tugas yang anda hantar mungkin dihantar kepada pembekal model bahasa besar pihak ketiga hanya untuk menjana laporan. Anda boleh pilih untuk tidak guna ciri itu.\n• Mengekalkan keselamatan dan menambah baik kestabilan (cth. mendiagnosis kegagalan).\n• Kami tidak gunakan maklumat peribadi anda untuk iklan pihak ketiga.",
      "3. Penyimpanan, pengekalan dan pemadaman\n• Data disimpan pada pelayan yang kami urus dan pada peranti anda.\n• Anda boleh minta padam akaun dalam Profil. Akaun memasuki tempoh tangguh soft-delete 30 hari apabila anda boleh log masuk dan pulihkan. Selepas itu kami padam kekal akaun dan data awan berkaitan, kecuali undang-undang mewajibkan pengekalan.\n• Anda juga boleh sunting atau padam tugas individu pada bila-bila masa.",
      "4. Perkongsian dan pendedahan\n• Kami tidak jual maklumat peribadi anda.\n• Kami hanya dedahkan maklumat apabila: diwajibkan undang-undang atau pihak berkuasa; untuk melindungi pengguna atau keselamatan awam; dengan persetujuan jelas anda; atau apabila anda secara jelas picu laporan AI dan kami hantar kandungan yang anda serah kepada pemproses untuk tujuan itu.\n• Penyedia yang membantu pengehosan atau pengoperasian memproses data hanya mengikut arahan kami dan untuk tujuan tersebut.",
      "5. Kanak-kanak\nAplikasi tidak ditujukan kepada kanak-kanak di bawah 13 tahun (atau umur lebih tinggi yang diperlukan dalam bidang kuasa anda). Kami tidak sengaja kumpul data mereka. Jika kami ketahui, kami akan padam segera.",
      "6. Hak anda\n• Akses dan kemas kini profil; urus tugas.\n• Minta padam akaun dan pulihkan dalam tempoh tangguh.\n• Jika undang-undang terpakai (cth. GDPR) memberi hak, anda mungkin mempunyai hak akses, pembetulan, pemadaman, sekatan, bantahan atau membuat aduan kepada pihak berkuasa. Hubungi kami untuk melaksanakannya.",
      "7. Pemindahan antarabangsa\nPelayan atau pemproses mungkin berada di negara lain. Jika berlaku pemindahan, kami ambil perlindungan munasabah. Penggunaan berterusan bermakna anda faham pemindahan sedemikian mungkin berlaku.",
      "8. Hubungi\nSoalan tentang dasar ini: {email}, atau maklum balas dalam aplikasi. Jika salinan web awam diterbitkan, ia akan sepadan dengan teks dalam aplikasi pada tarikh versi yang sama."
    ]
  },
  "terms": {
    "title": "Terma penggunaan",
    "updated": "Kemaskini terakhir: 2026-08-04",
    "paragraphs": [
      "Sila baca Terma ini sebelum menggunakan Upgrade. Dengan mendaftar atau menggunakan Aplikasi, anda bersetuju dengan Terma ini dan Dasar privasi. Jika tidak bersetuju, jangan gunakan Aplikasi.",
      "1. Perkhidmatan\nUpgrade menyediakan pengurusan tugas peribadi, segerak awan, statistik dan laporan berkala. Kami boleh menambah baik atau mengubah ciri dan akan maklumkan perubahan material secara munasabah. Sesetengah keupayaan (laporan AI) bergantung kepada pihak ketiga dan mungkin tidak tersedia.",
      "2. Akaun dan penggunaan yang diterima\n• Lindungi kelayakan anda; anda bertanggungjawab atas aktiviti di bawah akaun.\n• Jangan gunakan perkhidmatan untuk tujuan menyalahi undang-undang, memudaratkan, atau menyerang/mengganggu sistem.\n• Anda boleh minta padam dalam Profil. Soft-delete boleh dibatalkan dalam 30 hari; selepas itu kekal.",
      "3. Kandungan dan IP\n• Anda mengekalkan hak ke atas kandungan yang anda cipta dan memberikan kami hak pemprosesan terhad yang diperlukan untuk perkhidmatan (penyimpanan, segerak dan laporan yang anda minta).\n• Tanda dagangan, UI dan kod milik pembangun atau pemberi lesen. Kecuali dibenarkan undang-undang, jangan salin, kejuruteraan songsang atau edarkan semula Aplikasi.",
      "4. Penafian\nSetakat dibenarkan undang-undang, perkhidmatan disediakan “seadanya”. Kami akan membantu secara munasabah semasa gangguan kerana force majeure, rangkaian, peranti atau pihak ketiga, tanpa jaminan melebihi undang-undang. Kandungan AI hanya untuk rujukan dan bukan nasihat profesional.",
      "5. Perubahan dan penamatan\nKami boleh kemas kini Terma ini; penggunaan selepas kemas kini bermakna penerimaan. Kami boleh hadkan atau tamatkan akses atas pelanggaran serius.",
      "6. Undang-undang terpakai\nJika peruntukan bercanggah dengan undang-undang wajib, undang-undang itu diguna pakai; yang lain kekal. Pertikaian patut diselesaikan secara baik terlebih dahulu; jika tidak, boleh dibawa ke mahkamah di tempat kedudukan pembangun, kecuali undang-undang wajib menentukan sebaliknya.",
      "7. Hubungi\nSoalan tentang Terma ini: {email}."
    ]
  }
};
locales["tr"] = {
  "privacy": {
    "title": "Gizlilik politikası",
    "updated": "Son güncelleme: 2026-08-04",
    "paragraphs": [
      "Upgrade’a (“Uygulama”) hoş geldiniz. Gizliliğinize saygı duyuyoruz. Bu politika hangi bilgileri topladığımızı, nasıl kullandığımızı ve koruduğumuzu ve seçeneklerinizi açıklar. Uygulamayı kullanarak bu politikayı kabul etmiş sayılırsınız.",
      "1. Topladığımız bilgiler\n• Hesap: kullanıcı adı ve hash’lenmiş parola (düz metin parola saklamayız).\n• Profil: sağlamayı seçtiğiniz takma ad, avatar, biyografi ve cinsiyet.\n• Görev verileri: başlıklar, ayrıntılar, son tarihler ve durum (cihazda kullanım ve bulut senkronu için).\n• Teknik günlükler: güvenilirlik için sınırlı işletim günlükleri (örn. istek zamanı, hata kodları). Reklam için reklam tanımlayıcıları toplamayız ve kişisel bilgilerinizi reklamverenlere satmayız.",
      "2. Bilgileri nasıl kullanırız\n• Oturum açma, profil yönetimi, senkron, istatistik ve dönem raporları sağlamak.\n• İsteğe bağlı AI rapor özelliğini kullanırsanız, gönderdiğiniz ilgili görev metni yalnızca rapor oluşturmak için üçüncü taraf büyük dil modeli sağlayıcısına gönderilebilir. Bu özelliği kullanmamayı seçebilirsiniz.\n• Güvenliği sürdürmek ve kararlılığı iyileştirmek (örn. arıza teşhisi).\n• Kişisel bilgilerinizi üçüncü taraf reklamcılık için kullanmayız.",
      "3. Depolama, saklama ve silme\n• Veriler işlettiğimiz sunucularda ve cihazınızda saklanır.\n• Profil’den hesap silme talep edebilirsiniz. Hesap, oturum açıp geri yükleyebileceğiniz 30 günlük soft-delete süresine girer. Ardından yasal saklama zorunluluğu yoksa hesabı ve ilgili bulut verilerini kalıcı sileriz.\n• Tek tek görevleri istediğiniz zaman düzenleyebilir veya silebilirsiniz.",
      "4. Paylaşım ve açıklama\n• Kişisel bilgilerinizi satmayız.\n• Bilgiyi yalnızca şu durumlarda açıklayabiliriz: yasa veya yetkili makam gerektirirse; kullanıcıları veya kamu güvenliğini korumak için; açık onayınızla; veya AI raporunu açıkça tetiklediğinizde gönderdiğiniz içeriği bu amaçla işleyiciye ilettiğimizde.\n• Barındırma/işletmeye yardımcı sağlayıcılar verileri yalnızca talimatlarımız doğrultusunda ve bu amaçlarla işler.",
      "5. Çocuklar\nUygulama 13 yaşından küçük çocuklara (veya yargı bölgenizde daha yüksek bir yaşa) yönelik değildir. Bu çocukların kişisel bilgilerini bilerek toplamayız. Topladığımızı öğrenirsek derhal sileriz.",
      "6. Haklarınız\n• Profile erişmek ve güncellemek; görevleri yönetmek.\n• Hesap silme talep etmek ve süre içinde geri yüklemek.\n• Uygulanabilir hukuk (örn. GDPR) haklar tanıyorsa erişim, düzeltme, silme, kısıtlama, itiraz veya denetim makamına şikayet haklarınız olabilir. Kullanmak için bize ulaşın.",
      "7. Uluslararası aktarımlar\nSunucular veya işleyiciler başka ülkelerde olabilir. Aktarım olduğunda makul korumalar alırız. Kullanıma devam etmek, bu tür aktarımların olabileceğini anladığınız anlamına gelir.",
      "8. İletişim\nBu politika hakkında sorular: {email} veya uygulama içi geri bildirim. Herkese açık web kopyası yayımlanırsa, aynı sürüm tarihindeki uygulama içi metinle uyumlu olur."
    ]
  },
  "terms": {
    "title": "Kullanım şartları",
    "updated": "Son güncelleme: 2026-08-04",
    "paragraphs": [
      "Upgrade’ı kullanmadan önce bu Şartları okuyun. Kaydolarak veya Uygulamayı kullanarak bu Şartları ve Gizlilik politikasını kabul etmiş olursunuz. Kabul etmiyorsanız kullanmayın.",
      "1. Hizmet\nUpgrade kişisel görev yönetimi, bulut senkronu, istatistik ve dönem raporları sunar. Özellikleri iyileştirebilir veya değiştirebiliriz; önemli değişiklikleri makul şekilde bildiririz. Bazı yetenekler (AI raporları) üçüncü taraflara bağlıdır ve kullanılamayabilir.",
      "2. Hesaplar ve kabul edilebilir kullanım\n• Kimlik bilgilerinizi koruyun; hesabınızdaki faaliyetlerden siz sorumlusunuz.\n• Hizmeti yasa dışı, zararlı amaçlarla veya sistemi saldırmak/bozmak için kullanmayın.\n• Profil’den silme talep edebilirsiniz. Soft-delete 30 gün içinde iptal edilebilir; ardından kalıcıdır.",
      "3. İçerik ve fikri mülkiyet\n• Oluşturduğunuz içeriğin hakları sizde kalır; hizmeti işletmek için gerekli sınırlı işleme haklarını (depolama, senkron ve istediğiniz raporlar) bize verirsiniz.\n• Markalar, arayüz ve kod geliştiriciye veya lisans verenlere aittir. Yasaların izin verdiği durumlar dışında kopyalamayın, tersine mühendislik yapmayın veya yeniden dağıtmayın.",
      "4. Sorumluluk reddi\nYasaların izin verdiği ölçüde hizmet “olduğu gibi” sunulur. Mücbir sebep, ağ, cihaz veya üçüncü taraf kesintilerinde makul şekilde yardımcı oluruz; yasanın gerektirdiğinin ötesinde garanti vermeyiz. AI içeriği yalnızca referans içindir, profesyonel tavsiye değildir.",
      "5. Değişiklikler ve sona erdirme\nBu Şartları güncelleyebiliriz; güncellemeden sonra kullanım kabul anlamına gelir. Ciddi ihlallerde erişimi sınırlayabilir veya sona erdirebiliriz.",
      "6. Uygulanacak hukuk\nBir hüküm emredici hukukla çelişirse o hukuk geçerli olur; geri kalanı yürürlükte kalır. Uyuşmazlıklar önce dostane çözülmeli; aksi halde emredici hukuk başka bir şey demedikçe geliştiricinin bulunduğu yer mahkemelerinde görülebilir.",
      "7. İletişim\nBu Şartlar hakkında sorular: {email}."
    ]
  }
};
locales["pl"] = {
  "privacy": {
    "title": "Polityka prywatności",
    "updated": "Ostatnia aktualizacja: 2026-08-04",
    "paragraphs": [
      "Witamy w Upgrade („Aplikacja”). Szanujemy Twoją prywatność. Ta polityka wyjaśnia, jakie informacje zbieramy, jak je wykorzystujemy i chronimy oraz jakie masz wybory. Korzystając z Aplikacji, potwierdzasz zapoznanie się z tą polityką.",
      "1. Informacje, które zbieramy\n• Konto: nazwa użytkownika i zahashowane hasło (nie przechowujemy haseł w postaci jawnej).\n• Profil: pseudonim, awatar, bio i płeć, które zdecydujesz się podać.\n• Dane zadań: tytuły, szczegóły, terminy i status do użytku lokalnego oraz synchronizacji w chmurze.\n• Logi techniczne: ograniczone logi operacyjne (np. czas żądań, kody błędów) dla niezawodności. Nie zbieramy identyfikatorów reklamowych do reklam i nie sprzedajemy danych osobowych reklamodawcom.",
      "2. Jak wykorzystujemy informacje\n• Zapewnienie logowania, zarządzania profilem, synchronizacji, statystyk i raportów okresowych.\n• Jeśli korzystasz z opcjonalnej funkcji raportów AI, tekst zadań, który wyślesz, może zostać przekazany zewnętrznemu dostawcy dużego modelu językowego wyłącznie w celu wygenerowania raportu. Możesz z tej funkcji nie korzystać.\n• Utrzymanie bezpieczeństwa i poprawa stabilności (np. diagnostyka awarii).\n• Nie wykorzystujemy danych osobowych do reklam osób trzecich.",
      "3. Przechowywanie, retencja i usuwanie\n• Dane są przechowywane na serwerach, które prowadzimy, oraz na Twoim urządzeniu.\n• Możesz poprosić o usunięcie konta w Profilu. Konto wchodzi w 30-dniowy okres soft-delete, w którym możesz się zalogować i przywrócić je. Potem trwale usuwamy konto i powiązane dane w chmurze, chyba że prawo wymaga retencji.\n• Możesz też w każdej chwili edytować lub usuwać pojedyncze zadania.",
      "4. Udostępnianie i ujawnianie\n• Nie sprzedajemy danych osobowych.\n• Ujawniamy informacje tylko gdy: wymaga tego prawo lub organ; dla ochrony użytkowników lub bezpieczeństwa publicznego; za wyraźną zgodą; lub gdy wyraźnie uruchamiasz raport AI i przekazujemy przesłaną treść przetwarzającemu w tym celu.\n• Dostawcy pomagający w hostingu lub eksploatacji przetwarzają dane wyłącznie według naszych instrukcji i w tych celach.",
      "5. Dzieci\nAplikacja nie jest skierowana do dzieci poniżej 13 lat (lub wyższego wieku wymaganego w Twojej jurysdykcji). Świadomie nie zbieramy ich danych. Jeśli się o tym dowiemy, niezwłocznie je usuniemy.",
      "6. Twoje prawa\n• Dostęp i aktualizacja profilu; zarządzanie zadaniami.\n• Żądanie usunięcia konta i przywrócenie w okresie karencji.\n• Gdy prawo właściwe (np. RODO) przyznaje prawa, możesz mieć prawo dostępu, sprostowania, usunięcia, ograniczenia, sprzeciwu lub skargi do organu nadzorczego. Skontaktuj się z nami, aby je wykonać.",
      "7. Transfery międzynarodowe\nSerwery lub przetwarzający mogą znajdować się w innych krajach. Przy transferach stosujemy rozsądne zabezpieczenia. Dalsze korzystanie oznacza, że rozumiesz możliwość takich transferów.",
      "8. Kontakt\nPytania dotyczące tej polityki: {email} lub opinia w aplikacji. Publiczna kopia WWW (jeśli opublikowana) będzie zgodna z tekstem w aplikacji z tą samą datą wersji."
    ]
  },
  "terms": {
    "title": "Warunki korzystania",
    "updated": "Ostatnia aktualizacja: 2026-08-04",
    "paragraphs": [
      "Przeczytaj te Warunki przed użyciem Upgrade. Rejestrując się lub korzystając z Aplikacji, akceptujesz te Warunki i Politykę prywatności. Jeśli się nie zgadzasz, nie używaj Aplikacji.",
      "1. Usługa\nUpgrade zapewnia osobiste zarządzanie zadaniami, synchronizację w chmurze, statystyki i raporty okresowe. Możemy ulepszać lub zmieniać funkcje i w rozsądny sposób poinformujemy o istotnych zmianach. Niektóre możliwości (raporty AI) zależą od stron trzecich i mogą być niedostępne.",
      "2. Konta i dopuszczalne użycie\n• Chroń dane logowania; odpowiadasz za aktywność na koncie.\n• Nie używaj usługi do celów niezgodnych z prawem, szkodliwych ani do atakowania/zakłócania systemu.\n• Możesz poprosić o usunięcie w Profilu. Soft-delete można anulować w ciągu 30 dni; potem jest trwałe.",
      "3. Treści i IP\n• Zachowujesz prawa do tworzonych treści i udzielasz nam ograniczonych praw przetwarzania potrzebnych do usługi (przechowywanie, sync i raporty na Twoje żądanie).\n• Znaki towarowe, interfejs i kod należą do dewelopera lub licencjodawców. O ile prawo nie pozwala, nie kopiuj, nie odtwarzaj inżynieryjnie ani nie redystrybuuj Aplikacji.",
      "4. Wyłączenie odpowiedzialności\nW zakresie dozwolonym przez prawo usługa jest świadczona „tak jak jest”. Rozsądnie pomożemy przy przerwach spowodowanych siłą wyższą, siecią, urządzeniami lub stronami trzecimi, bez gwarancji wykraczających poza prawo. Treści AI są tylko poglądowe i nie stanowią porady zawodowej.",
      "5. Zmiany i zakończenie\nMożemy aktualizować te Warunki; dalsze korzystanie oznacza akceptację. Przy poważnych naruszeniach możemy ograniczyć lub zakończyć dostęp.",
      "6. Prawo właściwe\nJeśli postanowienie koliduje z bezwzględnie obowiązującym prawem, to prawo ma pierwszeństwo; pozostałe postanowienia pozostają w mocy. Spory należy najpierw rozwiązywać polubownie; w przeciwnym razie mogą być wniesione do sądów właściwych dla siedziby dewelopera, chyba że prawo bezwzględnie stanowi inaczej.",
      "7. Kontakt\nPytania dotyczące tych Warunków: {email}."
    ]
  }
};
locales["nl"] = {
  "privacy": {
    "title": "Privacybeleid",
    "updated": "Laatst bijgewerkt: 2026-08-04",
    "paragraphs": [
      "Welkom bij Upgrade (de “App”). Wij respecteren uw privacy. Dit beleid legt uit welke informatie we verzamelen, hoe we die gebruiken en beschermen, en welke keuzes u heeft. Door de App te gebruiken erkent u dit beleid.",
      "1. Informatie die we verzamelen\n• Account: gebruikersnaam en gehashte wachtwoord (geen plaintext-wachtwoorden).\n• Profiel: bijnaam, avatar, bio en geslacht die u kiest te verstrekken.\n• Taakgegevens: titels, details, deadlines en status voor lokaal gebruik en cloud-sync.\n• Technische logs: beperkte operationele logs (bijv. verzoektijden, foutcodes) voor betrouwbaarheid. We verzamelen geen advertentie-ID’s voor ads en verkopen uw persoonsgegevens niet aan adverteerders.",
      "2. Hoe we informatie gebruiken\n• Inloggen, profielbeheer, sync, statistieken en periodieke rapporten leveren.\n• Als u de optionele AI-rapportfunctie gebruikt, kan taaktekst die u indient naar een externe aanbieder van grote taalmodellen worden gestuurd uitsluitend om het rapport te genereren. U kunt die functie niet gebruiken.\n• Beveiliging handhaven en stabiliteit verbeteren (bijv. storingen diagnosticeren).\n• We gebruiken uw persoonsgegevens niet voor advertenties van derden.",
      "3. Opslag, bewaartermijn en verwijdering\n• Gegevens worden opgeslagen op servers die wij beheren en op uw apparaat.\n• U kunt accountverwijdering aanvragen in Profiel. Het account gaat een soft-delete-respijtperiode van 30 dagen in waarin u kunt inloggen en herstellen. Daarna wissen we het account en gerelateerde cloudgegevens permanent, tenzij de wet bewaring vereist.\n• U kunt afzonderlijke taken ook op elk moment bewerken of verwijderen.",
      "4. Delen en openbaarmaking\n• We verkopen uw persoonsgegevens niet.\n• We verstrekken informatie alleen wanneer: wet of bevoegde autoriteit dat eist; ter bescherming van gebruikers of openbare veiligheid; met uw duidelijke toestemming; of wanneer u expliciet een AI-rapport start en wij de ingediende inhoud daarvoor naar de verwerker sturen.\n• Dienstverleners die helpen hosten of exploiteren verwerken gegevens alleen volgens onze instructies en voor die doelen.",
      "5. Kinderen\nDe App is niet gericht op kinderen onder 13 (of een hogere leeftijd die in uw rechtsgebied geldt). We verzamelen hun gegevens niet bewust. Als we dat toch hebben gedaan, wissen we die meteen.",
      "6. Uw rechten\n• Profiel inzien en bijwerken; taken beheren.\n• Accountverwijdering aanvragen en herstellen binnen de respijtperiode.\n• Waar toepasselijk recht (bijv. AVG) rechten geeft, kunt u rechten hebben op inzage, rectificatie, wissing, beperking, bezwaar of een klacht bij een toezichthouder. Neem contact op om ze uit te oefenen.",
      "7. Internationale doorgiften\nServers of verwerkers kunnen in andere landen staan. Bij doorgiften nemen we redelijke waarborgen. Voortgezet gebruik betekent dat u begrijpt dat zulke doorgiften kunnen plaatsvinden.",
      "8. Contact\nVragen over dit beleid: {email}, of in-app feedback. Als er een openbare webkopie is, komt die overeen met de in-app-tekst van dezelfde versiedatum."
    ]
  },
  "terms": {
    "title": "Gebruiksvoorwaarden",
    "updated": "Laatst bijgewerkt: 2026-08-04",
    "paragraphs": [
      "Lees deze Voorwaarden voordat u Upgrade gebruikt. Door te registreren of de App te gebruiken stemt u in met deze Voorwaarden en het Privacybeleid. Stemt u niet in, gebruik de App dan niet.",
      "1. Dienst\nUpgrade biedt persoonlijk taakbeheer, cloud-sync, statistieken en periodieke rapporten. We kunnen functies verbeteren of wijzigen en communiceren materiële wijzigingen op redelijke wijze. Sommige mogelijkheden (AI-rapporten) hangen af van derden en kunnen niet beschikbaar zijn.",
      "2. Accounts en aanvaardbaar gebruik\n• Bewaar uw inloggegevens veilig; u bent verantwoordelijk voor activiteit onder uw account.\n• Gebruik de dienst niet voor onrechtmatige of schadelijke doelen, of om het systeem aan te vallen/verstoren.\n• U kunt verwijdering aanvragen in Profiel. Soft-delete kan binnen 30 dagen worden geannuleerd; daarna is het permanent.",
      "3. Inhoud en IE\n• U behoudt rechten op inhoud die u maakt en verleent ons de beperkte verwerkingsrechten die nodig zijn voor de dienst (opslag, sync en rapporten die u vraagt).\n• Merken, UI en code behoren toe aan de ontwikkelaar of licentiegevers. Behalve waar de wet het toestaat: niet kopiëren, reverse-engineeren of herdistribueren.",
      "4. Disclaimer\nVoor zover de wet toelaat, wordt de dienst “as is” geleverd. We helpen redelijk bij storingen door overmacht, netwerken, apparaten of derden, zonder garanties die verder gaan dan de wet. AI-inhoud is alleen ter referentie en geen professioneel advies.",
      "5. Wijzigingen en beëindiging\nWe kunnen deze Voorwaarden bijwerken; gebruik na een update betekent aanvaarding. Bij ernstige schendingen kunnen we toegang beperken of beëindigen.",
      "6. Toepasselijk recht\nAls een bepaling conflicteert met dwingend recht, prevaleert dat recht; de rest blijft gelden. Geschillen eerst in der minne oplossen; anders kunnen ze worden voorgelegd aan rechtbanken waar de ontwikkelaar is gevestigd, tenzij dwingend recht anders voorschrijft.",
      "7. Contact\nVragen over deze Voorwaarden: {email}."
    ]
  }
};
locales["sv"] = {
  "privacy": {
    "title": "Integritetspolicy",
    "updated": "Senast uppdaterad: 2026-08-04",
    "paragraphs": [
      "Välkommen till Upgrade (“Appen”). Vi respekterar din integritet. Denna policy förklarar vilken information vi samlar in, hur vi använder och skyddar den samt vilka val du har. Genom att använda Appen bekräftar du denna policy.",
      "1. Information vi samlar in\n• Konto: användarnamn och hashad lösenord (vi lagrar inte lösenord i klartext).\n• Profil: smeknamn, avatar, bio och kön som du väljer att ange.\n• Uppgiftsdata: titlar, detaljer, förfallodatum och status för lokal användning och molnsynk.\n• Tekniska loggar: begränsade driftloggar (t.ex. förfrågningstider, felkoder) för tillförlitlighet. Vi samlar inte in reklamidentifierare för annonser och säljer inte personuppgifter till annonsörer.",
      "2. Hur vi använder information\n• Tillhandahålla inloggning, profilhantering, synk, statistik och periodrapporter.\n• Om du använder den valfria AI-rapportfunktionen kan uppgiftstext som du skickar skickas till en tredjepartsleverantör av stora språkmodeller enbart för att generera rapporten. Du kan välja att inte använda funktionen.\n• Upprätthålla säkerhet och förbättra stabilitet (t.ex. felsökning).\n• Vi använder inte dina personuppgifter för tredjepartsannonsering.",
      "3. Lagring, bevarande och radering\n• Data lagras på servrar vi driver och på din enhet.\n• Du kan begära kontoradering i Profil. Kontot går in i en 30-dagars soft-delete-period då du kan logga in och återställa. Därefter raderar vi kontot och relaterad molndata permanent, om inte lag kräver bevarande.\n• Du kan också redigera eller radera enskilda uppgifter när som helst.",
      "4. Delning och utlämnande\n• Vi säljer inte dina personuppgifter.\n• Vi lämnar ut information endast när: lag eller behörig myndighet kräver det; för att skydda användare eller allmän säkerhet; med ditt tydliga samtycke; eller när du uttryckligen startar en AI-rapport och vi överför det innehåll du skickar till behandlaren för det syftet.\n• Leverantörer som hjälper oss att hosta eller driva Appen behandlar data endast enligt våra instruktioner och för dessa syften.",
      "5. Barn\nAppen riktar sig inte till barn under 13 år (eller högre ålder som krävs i din jurisdiktion). Vi samlar inte medvetet in deras uppgifter. Om vi får kännedom om det raderar vi dem omgående.",
      "6. Dina rättigheter\n• Få tillgång till och uppdatera profil; hantera uppgifter.\n• Begära kontoradering och återställa inom fristen.\n• Där tillämplig lag (t.ex. GDPR) ger rättigheter kan du ha rätt till tillgång, rättelse, radering, begränsning, invändning eller klagomål till tillsynsmyndighet. Kontakta oss för att utöva dem.",
      "7. Internationella överföringar\nServrar eller behandlare kan finnas i andra länder. Vid överföringar vidtar vi rimliga skyddsåtgärder. Fortsatt användning innebär att du förstår att sådana överföringar kan ske.",
      "8. Kontakt\nFrågor om denna policy: {email}, eller feedback i appen. Om en offentlig webbkopia publiceras överensstämmer den med apptexten för samma versionsdatum."
    ]
  },
  "terms": {
    "title": "Användarvillkor",
    "updated": "Senast uppdaterad: 2026-08-04",
    "paragraphs": [
      "Läs dessa Villkor innan du använder Upgrade. Genom att registrera dig eller använda Appen godkänner du dessa Villkor och Integritetspolicyn. Om du inte godkänner, använd inte Appen.",
      "1. Tjänst\nUpgrade erbjuder personlig uppgiftshantering, molnsynk, statistik och periodrapporter. Vi kan förbättra eller ändra funktioner och meddelar väsentliga ändringar på ett rimligt sätt. Vissa funktioner (AI-rapporter) beror på tredje part och kan vara otillgängliga.",
      "2. Konton och godtagbar användning\n• Skydda dina uppgifter; du ansvarar för aktivitet under ditt konto.\n• Använd inte tjänsten för olagliga eller skadliga syften, eller för att attackera/störa systemet.\n• Du kan begära radering i Profil. Soft-delete kan avbrytas inom 30 dagar; därefter är den permanent.",
      "3. Innehåll och IP\n• Du behåller rättigheter till innehåll du skapar och ger oss de begränsade behandlingsrättigheter som behövs för tjänsten (lagring, synk och rapporter du begär).\n• Varumärken, UI och kod tillhör utvecklaren eller licensgivare. Utom där lag tillåter: kopiera inte, reverse-engineera inte och distribuera inte om Appen.",
      "4. Ansvarsfriskrivning\nI den mån lagen tillåter tillhandahålls tjänsten “i befintligt skick”. Vi hjälper rimligen vid avbrott orsakade av force majeure, nätverk, enheter eller tredje part, utan garantier utöver lagen. AI-innehåll är endast referens och inte professionell rådgivning.",
      "5. Ändringar och uppsägning\nVi kan uppdatera dessa Villkor; fortsatt användning efter uppdatering innebär godkännande. Vi kan begränsa eller avsluta åtkomst vid allvarliga överträdelser.",
      "6. Tillämplig lag\nOm en bestämmelse strider mot tvingande lag gäller den lagen; övrigt består. Tvister bör först lösas i godo; annars kan de väckas i domstol där utvecklaren är belägen, om inte tvingande lag säger annat.",
      "7. Kontakt\nFrågor om dessa Villkor: {email}."
    ]
  }
};
locales["hi"] = {
  "privacy": {
    "title": "गोपनीयता नीति",
    "updated": "अंतिम अपडेट: 2026-08-04",
    "paragraphs": [
      "Upgrade (“ऐप”) में आपका स्वागत है। हम आपकी गोपनीयता का सम्मान करते हैं। यह नीति बताती है कि हम कौन-सी जानकारी एकत्र करते हैं, कैसे उपयोग और सुरक्षा करते हैं, और आपके विकल्प क्या हैं। ऐप का उपयोग करके आप इस नीति को स्वीकार करते हैं।",
      "1. हम जो जानकारी एकत्र करते हैं\n• खाता: उपयोगकर्ता नाम और हैश किया गया पासवर्ड (हम सादा पाठ पासवर्ड नहीं रखते)।\n• प्रोफ़ाइल: उपनाम, अवतार, बायो और लिंग जो आप देना चुनते हैं।\n• कार्य डेटा: शीर्षक, विवरण, नियत तारीखें और स्थिति — स्थानीय उपयोग तथा क्लाउड सिंक के लिए।\n• तकनीकी लॉग: विश्वसनीयता के लिए सीमित परिचालन लॉग (जैसे अनुरोध समय, त्रुटि कोड)। हम विज्ञापन के लिए विज्ञापन पहचानकर्ता एकत्र नहीं करते और विज्ञापनदाताओं को व्यक्तिगत जानकारी नहीं बेचते।",
      "2. हम जानकारी का उपयोग कैसे करते हैं\n• साइन-इन, प्रोफ़ाइल प्रबंधन, सिंक, आँकड़े और अवधि रिपोर्ट प्रदान करना।\n• यदि आप वैकल्पिक AI रिपोर्ट सुविधा उपयोग करते हैं, तो आपके द्वारा भेजा गया संबंधित कार्य पाठ केवल रिपोर्ट बनाने के लिए किसी तृतीय-पक्ष बड़े भाषा मॉडल प्रदाता को भेजा जा सकता है। आप वह सुविधा उपयोग न करने का विकल्प चुन सकते हैं।\n• सुरक्षा बनाए रखना और स्थिरता सुधारना (जैसे विफलताओं का निदान)।\n• हम आपकी व्यक्तिगत जानकारी का उपयोग तृतीय-पक्ष विज्ञापन के लिए नहीं करते।",
      "3. भंडारण, प्रतिधारण और विलोपन\n• डेटा हमारे संचालित सर्वरों और आपके डिवाइस पर संग्रहीत होता है।\n• आप प्रोफ़ाइल में खाता विलोपन का अनुरोध कर सकते हैं। खाता 30-दिन के soft-delete अनुग्रह काल में जाता है जिसमें आप साइन इन करके पुनर्स्थापित कर सकते हैं। उसके बाद हम खाता और संबंधित क्लाउड डेटा स्थायी रूप से हटा देते हैं, जब तक कानून प्रतिधारण न माँगे।\n• आप कभी भी अलग-अलग कार्यों को संपादित या हटा सकते हैं।",
      "4. साझाकरण और प्रकटीकरण\n• हम आपकी व्यक्तिगत जानकारी नहीं बेचते।\n• हम जानकारी केवल तब प्रकट कर सकते हैं जब: कानून या सक्षम प्राधिकारी माँगे; उपयोगकर्ताओं या सार्वजनिक सुरक्षा की रक्षा के लिए; आपकी स्पष्ट सहमति से; या जब आप स्पष्ट रूप से AI रिपोर्ट शुरू करें और हम आपके भेजे गए कंटेंट को उसी उद्देश्य से प्रोसेसर को भेजें।\n• होस्टिंग/संचालन में सहायता करने वाले प्रदाता डेटा केवल हमारे निर्देशों और उन उद्देश्यों के लिए संसाधित करते हैं।",
      "5. बच्चे\nऐप 13 वर्ष से कम (या आपके क्षेत्राधिकार में आवश्यक उच्च आयु) के बच्चों के लिए नहीं है। हम जानबूझकर उनकी व्यक्तिगत जानकारी एकत्र नहीं करते। यदि पता चले तो हम उसे शीघ्र हटा देंगे।",
      "6. आपके अधिकार\n• प्रोफ़ाइल देखना/अपडेट करना; कार्य प्रबंधित करना।\n• खाता विलोपन का अनुरोध और अनुग्रह काल में पुनर्स्थापना।\n• जहाँ लागू कानून (जैसे GDPR) अधिकार देता है, आपके पास पहुँच, सुधार, विलोपन, प्रतिबंध, आपत्ति या नियामक के पास शिकायत के अधिकार हो सकते हैं। इन्हें प्रयोग करने के लिए हमसे संपर्क करें।",
      "7. अंतरराष्ट्रीय स्थानांतरण\nसर्वर या प्रोसेसर अन्य देशों में हो सकते हैं। स्थानांतरण होने पर हम उचित सुरक्षा उपाय करते हैं। निरंतर उपयोग का अर्थ है कि आप समझते हैं कि ऐसे स्थानांतरण हो सकते हैं।",
      "8. संपर्क\nइस नीति के बारे में प्रश्न: {email}, या इन-ऐप फ़ीडबैक। यदि सार्वजनिक वेब प्रति प्रकाशित हो, तो वह उसी संस्करण तिथि के इन-ऐप पाठ से मेल खाएगी।"
    ]
  },
  "terms": {
    "title": "उपयोग की शर्तें",
    "updated": "अंतिम अपडेट: 2026-08-04",
    "paragraphs": [
      "Upgrade उपयोग करने से पहले ये शर्तें पढ़ें। पंजीकरण या ऐप उपयोग करके आप इन शर्तों और गोपनीयता नीति से सहमत होते हैं। यदि सहमत नहीं हैं, तो ऐप उपयोग न करें।",
      "1. सेवा\nUpgrade व्यक्तिगत कार्य प्रबंधन, क्लाउड सिंक, आँकड़े और अवधि रिपोर्ट प्रदान करता है। हम सुविधाएँ सुधार/बदल सकते हैं और महत्वपूर्ण परिवर्तन उचित तरीके से सूचित करेंगे। कुछ क्षमताएँ (AI रिपोर्ट) तृतीय-पक्ष पर निर्भर हैं और अनुपलब्ध हो सकती हैं।",
      "2. खाते और स्वीकार्य उपयोग\n• अपनी साख सुरक्षित रखें; आप खाते की गतिविधि के लिए जिम्मेदार हैं।\n• सेवा का उपयोग अवैध, हानिकारक उद्देश्यों या सिस्टम पर हमला/बाधा डालने के लिए न करें।\n• प्रोफ़ाइल में विलोपन का अनुरोध कर सकते हैं। Soft-delete 30 दिनों में रद्द हो सकता है; उसके बाद स्थायी।",
      "3. सामग्री और IP\n• आपके द्वारा बनाई सामग्री के अधिकार आपके पास रहते हैं; सेवा चलाने के लिए आवश्यक सीमित प्रसंस्करण अधिकार (भंडारण, सिंक और आपके अनुरोध पर रिपोर्ट) हमें देते हैं।\n• ट्रेडमार्क, UI और कोड डेवलपर या लाइसेंसदाताओं के हैं। कानून द्वारा अनुमत के अलावा कॉपी, रिवर्स इंजीनियर या पुनर्वितरित न करें।",
      "4. अस्वीकरण\nकानून द्वारा अनुमत सीमा तक सेवा “जैसी है” प्रदान की जाती है। अप्रत्याशित घटना, नेटवर्क, डिवाइस या तृतीय-पक्ष रुकावटों में हम उचित सहायता करेंगे, पर कानून से आगे की गारंटी नहीं। AI सामग्री केवल संदर्भ के लिए है, पेशेवर सलाह नहीं।",
      "5. परिवर्तन और समाप्ति\nहम इन शर्तों को अपडेट कर सकते हैं; अपडेट के बाद उपयोग स्वीकृति माना जाता है। गंभीर उल्लंघन पर पहुँच सीमित या समाप्त कर सकते हैं।",
      "6. लागू कानून\nयदि कोई प्रावधान अनिवार्य कानून से टकराए तो वह कानून प्रभावी रहेगा; शेष प्रभावी रहेंगे। विवाद पहले सौहार्दपूर्ण हल करें; अन्यथा डेवलपर के स्थान के न्यायालयों में लाए जा सकते हैं, जब तक अनिवार्य कानून अन्यथा न कहे।",
      "7. संपर्क\nइन शर्तों के बारे में प्रश्न: {email}."
    ]
  }
};

const EXPECTED = [
  'en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'it',
  'ru', 'vi', 'th', 'id', 'ms', 'tr', 'pl', 'nl', 'sv', 'hi',
]

for (const code of EXPECTED) {
  if (!locales[code]?.privacy?.paragraphs?.length || !locales[code]?.terms?.paragraphs?.length) {
    console.error('Missing legal pack:', code)
    process.exit(1)
  }
}

const payload = { updated: UPDATED, locales }

const sharedPath = path.join(root, 'shared', 'legal-i18n.json')
fs.mkdirSync(path.dirname(sharedPath), { recursive: true })
fs.writeFileSync(sharedPath, JSON.stringify(payload, null, 2) + '\n', 'utf8')

const websiteJs = `/**
 * 公开法律页多语言正文（与应用内同源，上架审核用）。
 * Generated by scripts/build-legal-i18n.mjs — do not edit by hand.
 */
window.UPGRADE_LEGAL = ${JSON.stringify(payload, null, 2)};
`
fs.writeFileSync(path.join(root, 'website', 'js', 'legal.js'), websiteJs, 'utf8')

const frontendJs = `/**
 * 应用内隐私政策 / 用户协议多语言正文（与官网同源）。
 * Generated by scripts/build-legal-i18n.mjs — do not edit by hand.
 */

/** @typedef {{ title: string, updated: string, paragraphs: string[] }} LegalDoc */

/** @type {{ updated: string, locales: Record<string, { privacy: LegalDoc, terms: LegalDoc }> }} */
const LEGAL = ${JSON.stringify(payload, null, 2)}

export const LEGAL_UPDATED = LEGAL.updated
export const LEGAL_LOCALES = LEGAL.locales
export default LEGAL
`
fs.writeFileSync(path.join(root, 'app', 'utils', 'legalLocales.js'), frontendJs, 'utf8')

console.log('Wrote', EXPECTED.length, 'locales → shared/, website/js/legal.js, app/utils/legalLocales.js')
