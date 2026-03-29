'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] },
  },
};

const sections = [
  {
    title: '1. Veri Sorumlusu',
    content:
      'Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla Swiip tarafından hazırlanmıştır. Kişisel verileriniz aşağıda açıklanan amaçlar ve hukuki sebepler doğrultusunda işlenmektedir.',
  },
  {
    title: '2. Toplanan Kişisel Veriler',
    content:
      'Hesap oluşturma sırasında: e-posta adresi, kullanıcı adı, şifre (hash\'lenmiş). Profil bilgileri: görünen ad, avatar, banner, biyografi, durum. Kullanım verileri: IP adresi, cihaz bilgisi, tarayıcı türü, oturum süreleri. İçerik verileri: mesajlar, paylaşılan dosyalar, ses/görüntü iletişim meta verileri (içerik kaydedilmez). Çerezler: oturum yönetimi ve kimlik doğrulama için zorunlu çerezler.',
  },
  {
    title: '3. Kişisel Verilerin İşlenme Amaçları',
    content:
      'Verileriniz şu amaçlarla işlenmektedir: Hizmetin sunulması ve sürdürülmesi; mesaj ve içeriklerin alıcılara iletilmesi; hesap güvenliğinin sağlanması ve kimlik doğrulama; hizmet ile ilgili bildirimlerin gönderilmesi; hizmetin iyileştirilmesi ve optimizasyonu; yasal yükümlülüklerin yerine getirilmesi; dolandırıcılık, kötüye kullanım ve Kullanım Koşulları ihlallerinin önlenmesi.',
  },
  {
    title: '4. Hukuki Sebepler (KVKK md. 5)',
    content:
      'Kişisel verileriniz şu hukuki sebeplere dayanılarak işlenmektedir: Açık rızanız (profil bilgileri, isteğe bağlı veriler); bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (hizmet sunumu); veri sorumlusunun meşru menfaati (hizmet güvenliği, iyileştirme); hukuki yükümlülüğün yerine getirilmesi (yasal talepler, suç bildirimi).',
  },
  {
    title: '5. Mesaj Gizliliği',
    content:
      'Mesajlarınız güvenli bağlantı (TLS) üzerinden iletilir ve şifreli biçimde saklanır. Özel mesajlarınızın içeriği üçüncü taraflara satılmaz. Özel mesajlarınız, yasal zorunluluk veya Kullanım Koşulları ihlali soruşturması (ör. taciz raporları) dışında okunmaz. Ses ve görüntü görüşmelerinin içeriği sunucularımızda kaydedilmez.',
  },
  {
    title: '6. Kişisel Verilerin Aktarılması',
    content:
      'Kişisel verileriniz satılmaz. Verileriniz şu durumlarda aktarılabilir: Hizmetin işletilmesine yardımcı olan altyapı sağlayıcılarına (barındırma, e-posta iletimi); yürürlükteki mevzuat gereği yetkili kamu kurum ve kuruluşlarına; diğer kullanıcılara yalnızca sizin herkese açık olarak paylaştığınız bilgiler (kullanıcı adı, avatar, durum). Verileriniz Türkiye dışındaki sunucularda işlenebilir; bu durumda KVKK\'nın yurt dışına aktarım hükümlerine uygun tedbirler alınır.',
  },
  {
    title: '7. Veri Saklama Süreleri',
    content:
      'Hesap bilgileriniz ve mesaj içerikleriniz hesabınız aktif olduğu sürece saklanır. Hesabınızı silmeniz halinde kişisel verileriniz 30 gün içinde silinir veya anonim hale getirilir (yasal saklama yükümlülükleri saklıdır). Sunucu günlükleri ve toplu analitik verileri anonim biçimde daha uzun süre saklanabilir.',
  },
  {
    title: '8. Veri Güvenliği Tedbirleri',
    content:
      'Verilerinizin korunması için endüstri standardı güvenlik önlemleri uygulanmaktadır: İletim sırasında şifreleme (TLS 1.3); veritabanı düzeyinde şifreli depolama; JWT token ve isteğe bağlı iki faktörlü kimlik doğrulama (2FA); düzenli güvenlik denetimleri; erişim kontrolü ve yetkilendirme mekanizmaları. Ancak hiçbir iletim veya depolama yöntemi %100 güvenli değildir.',
  },
  {
    title: '9. Çerezler',
    content:
      'Yalnızca hizmetin çalışması için zorunlu olan çerezler kullanılmaktadır: oturum yönetimi ve kimlik doğrulama çerezleri. Reklam amaçlı üçüncü taraf izleme çerezleri kullanılmamaktadır. Tarayıcı ayarlarınızdan çerez tercihlerinizi yönetebilirsiniz; ancak zorunlu çerezlerin devre dışı bırakılması hizmet işlevselliğini etkileyebilir.',
  },
  {
    title: '10. İlgili Kişi Hakları (KVKK md. 11)',
    content:
      'KVKK\'nın 11. maddesi kapsamında şu haklara sahipsiniz: Kişisel verilerinizin işlenip işlenmediğini öğrenme; işlenmişse buna ilişkin bilgi talep etme; işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme; KVKK md. 7 kapsamında silinmesini veya yok edilmesini isteme; düzeltme/silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme; işlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme; kanuna aykırı işlenme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme.',
  },
  {
    title: '11. Başvuru Yöntemi',
    content:
      'Yukarıdaki haklarınızı kullanmak için kvkk@swiip.app adresine e-posta göndererek veya uygulama içindeki Ayarlar > Gizlilik bölümünden başvurabilirsiniz. Başvurularınız en geç 30 gün içinde ücretsiz olarak yanıtlanacaktır. İşlemin ayrıca bir maliyet gerektirmesi halinde Kişisel Verileri Koruma Kurulu tarafından belirlenen tarife üzerinden ücret alınabilir.',
  },
  {
    title: '12. Çocukların Gizliliği',
    content:
      'Hizmet, 13 yaşın altındaki kullanıcılara yönelik değildir. 13 yaşın altındaki çocuklardan bilerek kişisel veri toplanmaz. Böyle bir durumun tespiti halinde ilgili veriler derhal silinir.',
  },
  {
    title: '13. Politika Değişiklikleri',
    content:
      'Bu Gizlilik Politikası zaman zaman güncellenebilir. Önemli değişiklikler hizmet içi bildirim veya e-posta yoluyla bildirilecektir. Değişiklikler yürürlüğe girdikten sonra hizmeti kullanmaya devam etmeniz, güncellenmiş politikayı kabul ettiğiniz anlamına gelir.',
  },
  {
    title: '14. İletişim',
    content:
      'Gizlilik ve KVKK ile ilgili sorularınız için: kvkk@swiip.app. Genel destek için: destek@swiip.app.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen" style={{ background: 'var(--color-bg-base)' }}>
      {/* Atmospheric orbs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, #10B981 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute bottom-0 -left-48 w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, #34D399 0%, transparent 65%)',
          }}
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-2xl mx-auto px-5 py-12"
      >
        {/* Back link */}
        <motion.div variants={itemVariants} className="mb-8">
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 text-sm transition-colors duration-fast hover:opacity-80"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <ArrowLeft size={14} />
            Kayıt sayfasına dön
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-accent-gradient)' }}
            >
              <Shield size={18} color="white" />
            </div>
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Swiip
            </span>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
          >
            Gizlilik Politikası & KVKK Aydınlatma Metni
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Son güncelleme: 28 Mart 2026
          </p>
        </motion.div>

        {/* Content */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-6 space-y-6"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: 'var(--shadow-float)',
          }}
        >
          <div
            className="rounded-xl p-4 text-sm leading-relaxed"
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") ve ilgili
            mevzuat kapsamında kişisel verilerinizin işlenmesine ilişkin sizi bilgilendirmek
            amacıyla hazırlanmıştır.
          </div>

          {sections.map((section) => (
            <div key={section.title}>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {section.title}
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {section.content}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.div variants={itemVariants} className="mt-6 text-center">
          <Link
            href="/terms"
            className="text-sm transition-colors duration-fast hover:opacity-80"
            style={{ color: 'var(--color-text-accent)' }}
          >
            Kullanım Koşulları
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
