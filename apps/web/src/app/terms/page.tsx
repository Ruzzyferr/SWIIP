'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';

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
    title: '1. Koşulların Kabulü',
    content:
      'Swiip hizmetine ("Hizmet") erişerek veya kullanarak bu Kullanım Koşullarını kabul etmiş olursunuz. Bu koşulları kabul etmiyorsanız lütfen Hizmeti kullanmayınız.',
  },
  {
    title: '2. Hizmet Tanımı',
    content:
      'Swiip; metin mesajlaşma, sesli ve görüntülü görüşme, dosya paylaşımı ve ilgili iş birliği özelliklerini sunan gerçek zamanlı bir iletişim platformudur. Hizmetin herhangi bir yönünü önceden bildirimde bulunarak değiştirme, askıya alma veya sonlandırma hakkımız saklıdır.',
  },
  {
    title: '3. Kullanıcı Hesapları',
    content:
      'Hesap oluştururken doğru ve eksiksiz bilgi sağlamalısınız. Hesap bilgilerinizin gizliliğinden ve hesabınız altında gerçekleşen tüm faaliyetlerden siz sorumlusunuz. Hizmeti kullanmak için en az 13 yaşında olmanız gerekmektedir.',
  },
  {
    title: '4. Kabul Edilebilir Kullanım',
    content:
      'Hizmeti şu amaçlarla kullanmamayı kabul edersiniz: Spam veya istenmeyen mesaj dağıtmak; zararlı yazılım yüklemek; diğer kullanıcıları taciz etmek, zorbalık yapmak veya tehdit etmek; herhangi bir kişi veya kuruluşun kimliğine bürünmek; yürürlükteki yasa ve düzenlemeleri ihlal etmek; Hizmete veya diğer kullanıcıların hesaplarına yetkisiz erişim sağlamaya çalışmak.',
  },
  {
    title: '5. Kullanıcı İçeriği',
    content:
      'Hizmet aracılığıyla oluşturduğunuz ve paylaştığınız içeriklerin mülkiyeti size aittir. İçerik yayınlayarak, Swiip\'e yalnızca Hizmetin işletilmesi ve iyileştirilmesi amacıyla içeriğinizi kullanma, saklama ve görüntüleme konusunda münhasır olmayan, dünya çapında bir lisans vermiş olursunuz. Paylaştığınız içeriklerden yalnızca siz sorumlusunuz.',
  },
  {
    title: '6. Gizlilik',
    content:
      'Hizmeti kullanımınız ayrıca bu Koşullara referans yoluyla dahil edilen Gizlilik Politikamız ve KVKK Aydınlatma Metnimiz kapsamındadır. Kişisel verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu anlamak için lütfen Gizlilik Politikamızı inceleyiniz.',
  },
  {
    title: '7. Fikri Mülkiyet',
    content:
      'Hizmetin tasarımı, özellikleri ve temelindeki teknoloji dahil olmak üzere tamamı Swiip\'e aittir ve fikri mülkiyet yasalarıyla korunmaktadır. Önceden yazılı izin almaksızın Hizmetin herhangi bir bölümünü kopyalayamaz, değiştiremez, dağıtamaz veya tersine mühendislik uygulayamazsınız.',
  },
  {
    title: '8. Hesap Askıya Alma ve Sonlandırma',
    content:
      'Hizmete erişiminizi herhangi bir zamanda, sebep göstererek veya göstermeksizin ve önceden bildirimde bulunmaksızın askıya alabilir veya sonlandırabiliriz. Sonlandırma halinde Hizmeti kullanma hakkınız derhal sona erer. Hesabınızı istediğiniz zaman Ayarlar > Hesap bölümünden silebilirsiniz.',
  },
  {
    title: '9. Sorumluluk Reddi',
    content:
      'Hizmet, açık veya zımni hiçbir garanti verilmeksizin "olduğu gibi" ve "mevcut olduğu şekilde" sunulmaktadır. Hizmetin kesintisiz, güvenli veya hatasız olacağını garanti etmiyoruz.',
  },
  {
    title: '10. Sorumluluk Sınırlandırması',
    content:
      'Yürürlükteki kanunların izin verdiği azami ölçüde, Swiip; Hizmeti kullanmanızdan kaynaklanan veya bununla bağlantılı dolaylı, arızi, özel, sonuç niteliğinde veya cezai tazminatlardan sorumlu tutulamaz.',
  },
  {
    title: '11. Uygulanacak Hukuk',
    content:
      'Bu Kullanım Koşulları Türkiye Cumhuriyeti yasalarına tabidir. Bu Koşullardan kaynaklanan veya bunlarla bağlantılı tüm uyuşmazlıklarda Türkiye Cumhuriyeti mahkemeleri yetkilidir.',
  },
  {
    title: '12. Koşullarda Değişiklik',
    content:
      'Bu Koşulları zaman zaman güncelleyebiliriz. Önemli değişiklikler hizmet içi bildirim veya e-posta yoluyla bildirilecektir. Değişiklikler yürürlüğe girdikten sonra Hizmeti kullanmaya devam etmeniz, güncellenmiş Koşulları kabul ettiğiniz anlamına gelir.',
  },
  {
    title: '13. İletişim',
    content:
      'Bu Koşullarla ilgili sorularınız için destek@swiip.app adresinden bize ulaşabilirsiniz.',
  },
];

export default function TermsPage() {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden" style={{ background: 'var(--color-bg-base)' }}>
      {/* Atmospheric orbs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, #34D399 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute bottom-0 -right-48 w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, #10B981 0%, transparent 65%)',
          }}
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-2xl mx-auto px-4 sm:px-5 py-8 sm:py-12"
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
              <FileText size={18} color="white" />
            </div>
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Swiip
            </span>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
          >
            Kullanım Koşulları
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Son güncelleme: 28 Mart 2026
          </p>
        </motion.div>

        {/* Content */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: 'var(--shadow-float)',
          }}
        >
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
            href="/privacy"
            className="text-sm transition-colors duration-fast hover:opacity-80"
            style={{ color: 'var(--color-text-accent)' }}
          >
            Gizlilik Politikası & KVKK
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
