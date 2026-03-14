import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type PurchaseStatus = "loading" | "success" | "error" | null;

interface PurchaseAnimationProps {
  status: PurchaseStatus;
  itemName?: string;
}

export function PurchaseAnimation({ status, itemName }: PurchaseAnimationProps) {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {status && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          data-testid="overlay-purchase-animation"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative"
          >
            {/* Фоновое свечение */}
            <div className="absolute inset-0 blur-3xl">
              <div className={`w-64 h-64 mx-auto rounded-full ${
                status === "loading" ? "bg-primary/30" :
                status === "success" ? "bg-green-500/30" :
                "bg-red-500/30"
              }`} />
            </div>

            {/* Основной контейнер */}
            <div className="relative glass glass-border rounded-2xl p-8 min-w-[320px]">
              <div className="flex flex-col items-center gap-6">
                
                {/* Анимация загрузки */}
                {status === "loading" && (
                  <>
                    <div className="relative">
                      {/* Вращающиеся кольца */}
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-24 h-24"
                      >
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary" />
                      </motion.div>
                      
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-2 w-20 h-20"
                      >
                        <div className="absolute inset-0 rounded-full border-4 border-accent/20 border-b-accent" />
                      </motion.div>

                      {/* Центральная иконка */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                      </div>
                    </div>

                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-bold text-primary">
                        {t('shop.processing', 'Обработка транзакции...')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t('shop.pleaseWait', 'Пожалуйста, подождите')}
                      </p>
                      {itemName && (
                        <p className="text-xs text-muted-foreground/70">
                          {itemName}
                        </p>
                      )}
                    </div>

                    {/* Пульсирующие точки */}
                    <div className="flex gap-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 1, 0.5],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                          className="w-2 h-2 rounded-full bg-primary"
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Анимация успеха */}
                {status === "success" && (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 15, stiffness: 300 }}
                      className="relative"
                    >
                      {/* Пульсирующие круги */}
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 1, opacity: 0.8 }}
                          animate={{ scale: 2.5, opacity: 0 }}
                          transition={{
                            duration: 2,
                            delay: i * 0.3,
                            repeat: Infinity,
                          }}
                          className="absolute inset-0 w-24 h-24 rounded-full border-4 border-green-500"
                        />
                      ))}
                      
                      <div className="relative w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-16 h-16 text-green-500" />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-center space-y-2"
                    >
                      <h3 className="text-2xl font-bold text-green-500">
                        {t('common.success', 'Успех!')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t('shop.purchaseSuccess', 'Покупка завершена')}
                      </p>
                    </motion.div>

                    {/* Конфетти анимация */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      {[...Array(20)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{
                            x: "50%",
                            y: "50%",
                            scale: 0,
                          }}
                          animate={{
                            x: `${Math.random() * 100}%`,
                            y: `${Math.random() * 100}%`,
                            scale: [0, 1, 0],
                            rotate: Math.random() * 360,
                          }}
                          transition={{
                            duration: 1.5,
                            ease: "easeOut",
                          }}
                          className="absolute w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: ["#06b6d4", "#a855f7", "#10b981"][i % 3],
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Анимация ошибки */}
                {status === "error" && (
                  <>
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", damping: 15, stiffness: 300 }}
                      className="relative"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.5, repeat: 3 }}
                        className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center"
                      >
                        <XCircle className="w-16 h-16 text-red-500" />
                      </motion.div>
                    </motion.div>

                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-center space-y-2"
                    >
                      <h3 className="text-2xl font-bold text-red-500">
                        {t('common.error', 'Ошибка')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t('shop.purchaseError', 'Не удалось завершить покупку')}
                      </p>
                    </motion.div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
