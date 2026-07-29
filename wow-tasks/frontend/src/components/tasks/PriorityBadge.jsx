import { useTranslation } from 'react-i18next';

export default function PriorityBadge({ priority }) {
  const { t } = useTranslation();
  return (
    <span className={`badge priority-${priority}`}>
      {t(`task.priorities.${priority}`, priority)}
    </span>
  );
}
