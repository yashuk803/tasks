import { useTranslation } from 'react-i18next';

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <span className={`badge status-${status}`}>
      {t(`task.statuses.${status}`, status)}
    </span>
  );
}
