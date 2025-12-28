/**
 * ModelRating Component
 * 5-star rating with optional comment and flag functionality
 *
 * Usage Examples:
 *
 * // Full version (with flag functionality)
 * <ModelRating
 *   modelId={model.id}
 *   currentRating={model.rating}
 *   ratingCount={model.ratingCount}
 *   onRated={(rating) => console.log('User rated:', rating)}
 * />
 *
 * // Compact version (inline in tables)
 * <ModelRating
 *   modelId={model.id}
 *   currentRating={model.rating}
 *   ratingCount={model.ratingCount}
 *   compact={true}
 * />
 *
 * // Read-only star display
 * <StarDisplay rating={4.5} count={23} size="md" />
 */

import React, { useState, useCallback } from 'react';
import { rateModel, flagModel } from '../src/services/modelStorage';

interface ModelRatingProps {
  modelId: string;
  currentRating: number;
  ratingCount: number;
  onRated?: (rating: number) => void;
  compact?: boolean;  // Smaller version for inline use
}

export const ModelRating: React.FC<ModelRatingProps> = ({
  modelId,
  currentRating,
  ratingCount,
  onRated,
  compact = false
}) => {
  const [hoveredStar, setHoveredStar] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleRate = useCallback((rating: number) => {
    try {
      rateModel(modelId, rating);
      setUserRating(rating);
      setSubmitted(true);
      onRated?.(rating);
    } catch (error) {
      console.error('Failed to rate:', error);
    }
  }, [modelId, onRated]);

  const handleFlag = useCallback(() => {
    if (!flagReason.trim()) return;

    try {
      flagModel(modelId, flagReason);
      setShowFlagDialog(false);
      setFlagReason('');
      alert('Model flagged for review. Thank you for your feedback.');
    } catch (error) {
      console.error('Failed to flag:', error);
    }
  }, [modelId, flagReason]);

  // Compact version (just stars)
  if (compact) {
    return (
      <div className="inline-flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="text-sm focus:outline-none"
            disabled={submitted}
          >
            <span className={
              star <= (hoveredStar || userRating || currentRating)
                ? 'text-yellow-400'
                : 'text-gray-600'
            }>
              ★
            </span>
          </button>
        ))}
        <span className="text-gray-500 text-xs ml-1">({ratingCount})</span>
      </div>
    );
  }

  // Full version
  return (
    <div className="bg-gray-700/30 rounded-lg p-4">
      <h4 className="text-white font-medium mb-3">Rate this model</h4>

      {/* Star rating */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => handleRate(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="text-2xl focus:outline-none transition-transform hover:scale-110"
              disabled={submitted}
            >
              <span className={
                star <= (hoveredStar || userRating || currentRating)
                  ? 'text-yellow-400'
                  : 'text-gray-600'
              }>
                ★
              </span>
            </button>
          ))}
        </div>
        <span className="text-gray-400 text-sm">
          {currentRating > 0 ? currentRating.toFixed(1) : 'No ratings'}
          ({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})
        </span>
      </div>

      {submitted && (
        <div className="text-green-400 text-sm mb-3">
          ✓ Thanks for rating!
        </div>
      )}

      {/* Flag button */}
      <div className="border-t border-gray-600 pt-3 mt-3">
        {!showFlagDialog ? (
          <button
            onClick={() => setShowFlagDialog(true)}
            className="text-sm text-gray-500 hover:text-red-400 transition-colors"
          >
            🚩 Flag as broken
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Please describe the issue..."
              className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleFlag}
                disabled={!flagReason.trim()}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600
                  text-white text-sm rounded"
              >
                Submit Flag
              </button>
              <button
                onClick={() => {
                  setShowFlagDialog(false);
                  setFlagReason('');
                }}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * StarDisplay - Read-only star display
 */
export const StarDisplay: React.FC<{ rating: number; count?: number; size?: 'sm' | 'md' | 'lg' }> = ({
  rating,
  count,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  };

  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          className={`${sizeClasses[size]} ${
            star <= rating ? 'text-yellow-400' : 'text-gray-600'
          }`}
        >
          ★
        </span>
      ))}
      {count !== undefined && (
        <span className="text-gray-500 text-xs ml-1">({count})</span>
      )}
    </div>
  );
};

export default ModelRating;
