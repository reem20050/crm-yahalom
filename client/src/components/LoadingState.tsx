interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = 'טוען...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
