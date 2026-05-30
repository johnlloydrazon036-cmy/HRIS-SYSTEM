import { Check } from "lucide-react";

type Props = {
  title: string;
  description?: string;
};

const SuccessToast = ({ title, description }: Props) => {
  return (
    <div className="relative w-[340px] overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_18px_40px_rgba(5,150,105,0.14)]">
      <div className="pointer-events-none absolute inset-0 bg-emerald-500/5" />

      <div className="relative flex items-start gap-3 p-4">
        <div className="success-toast-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          {description ? (
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="success-toast-progress absolute bottom-0 left-0 h-[3px] bg-emerald-500" />
    </div>
  );
};

export default SuccessToast;
