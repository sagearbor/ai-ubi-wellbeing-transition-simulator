/**
 * WellbeingScatterPlot Component
 *
 * Scatter plot showing AI Adoption (x-axis) vs Wellbeing (y-axis) for all countries.
 * Includes linear regression line with equation and R² value.
 *
 * Purpose: Validate that the simulation produces expected causal relationships:
 * - Higher AI investment + shared efficiencies should lead to higher wellbeing
 * - If inverse relationship appears, model needs adjustment
 */

import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
  Legend,
  ZAxis
} from 'recharts';
import { CountryStats } from '../types';

interface WellbeingScatterPlotProps {
  countryData: Record<string, CountryStats>;
  month: number;
}

interface DataPoint {
  id: string;
  name: string;
  aiAdoption: number;
  wellbeing: number;
  archetype: string;
  population: number;
  ubiReceived: number;
}

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  correlation: number;
}

// Calculate linear regression using least squares
function calculateLinearRegression(points: DataPoint[]): RegressionResult {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: 0, rSquared: 0, correlation: 0 };
  }

  // Calculate means
  const sumX = points.reduce((sum, p) => sum + p.aiAdoption, 0);
  const sumY = points.reduce((sum, p) => sum + p.wellbeing, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;
  let ssTotal = 0;
  let ssResidual = 0;

  for (const p of points) {
    numerator += (p.aiAdoption - meanX) * (p.wellbeing - meanY);
    denominator += (p.aiAdoption - meanX) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;

  // Calculate R²
  for (const p of points) {
    const predicted = slope * p.aiAdoption + intercept;
    ssResidual += (p.wellbeing - predicted) ** 2;
    ssTotal += (p.wellbeing - meanY) ** 2;
  }

  const rSquared = ssTotal !== 0 ? 1 - ssResidual / ssTotal : 0;

  // Calculate correlation coefficient (Pearson's r)
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (const p of points) {
    sumXY += (p.aiAdoption - meanX) * (p.wellbeing - meanY);
    sumX2 += (p.aiAdoption - meanX) ** 2;
    sumY2 += (p.wellbeing - meanY) ** 2;
  }
  const correlation = (sumX2 * sumY2) !== 0
    ? sumXY / Math.sqrt(sumX2 * sumY2)
    : 0;

  return { slope, intercept, rSquared, correlation };
}

// Color by archetype
const archetypeColors: Record<string, string> = {
  'rich-democracy': '#22c55e',      // green
  'middle-stable': '#3b82f6',       // blue
  'developing-fragile': '#f59e0b',  // amber
  'authoritarian': '#ef4444',       // red
  'failed-state': '#6b7280',        // gray
};

const archetypeLabels: Record<string, string> = {
  'rich-democracy': 'Rich Democracy',
  'middle-stable': 'Middle Stable',
  'developing-fragile': 'Developing Fragile',
  'authoritarian': 'Authoritarian',
  'failed-state': 'Failed State',
};

export const WellbeingScatterPlot: React.FC<WellbeingScatterPlotProps> = ({
  countryData,
  month
}) => {
  // Transform country data to scatter plot points
  const { dataPoints, regression, archetypeData } = useMemo(() => {
    const points: DataPoint[] = Object.values(countryData).map(country => ({
      id: country.id,
      name: country.name,
      aiAdoption: country.aiAdoption * 100, // Convert to percentage
      wellbeing: country.wellbeing,
      archetype: country.archetype,
      population: country.population,
      ubiReceived: country.totalUbiReceived || 0
    }));

    const reg = calculateLinearRegression(points);

    // Group by archetype for colored scatter
    const byArchetype: Record<string, DataPoint[]> = {};
    for (const p of points) {
      if (!byArchetype[p.archetype]) {
        byArchetype[p.archetype] = [];
      }
      byArchetype[p.archetype].push(p);
    }

    return { dataPoints: points, regression: reg, archetypeData: byArchetype };
  }, [countryData]);

  // Generate regression line points
  const regressionLineData = useMemo(() => {
    if (dataPoints.length < 2) return [];
    const minX = 0;
    const maxX = 100;
    return [
      { x: minX, y: regression.slope * minX + regression.intercept },
      { x: maxX, y: regression.slope * maxX + regression.intercept }
    ];
  }, [dataPoints, regression]);

  // Determine health of the relationship
  const relationshipHealth = useMemo(() => {
    if (regression.rSquared < 0.1) {
      return { status: 'weak', color: 'text-yellow-500', message: 'Weak correlation - model may need tuning' };
    }
    if (regression.slope < 0) {
      return { status: 'inverse', color: 'text-red-500', message: 'Inverse relationship - AI adoption hurting wellbeing!' };
    }
    if (regression.slope > 0 && regression.rSquared > 0.3) {
      return { status: 'healthy', color: 'text-green-500', message: 'Positive relationship - AI benefiting wellbeing' };
    }
    return { status: 'moderate', color: 'text-blue-500', message: 'Moderate positive relationship' };
  }, [regression]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as DataPoint;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="font-bold text-white">{data.name}</p>
          <p className="text-sm text-gray-300">
            AI Adoption: <span className="text-blue-400">{data.aiAdoption.toFixed(1)}%</span>
          </p>
          <p className="text-sm text-gray-300">
            Wellbeing: <span className="text-green-400">{data.wellbeing.toFixed(1)}</span>
          </p>
          <p className="text-sm text-gray-400">
            Type: {archetypeLabels[data.archetype] || data.archetype}
          </p>
          <p className="text-sm text-gray-400">
            UBI Received: ${(data.ubiReceived / 1e9).toFixed(2)}B
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
      {/* Header with regression stats */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">AI Adoption vs Wellbeing</h3>
          <p className="text-sm text-gray-400">Month {month} - Does AI investment improve wellbeing?</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm">
            <span className="text-gray-400">y = </span>
            <span className="text-blue-400">{regression.slope.toFixed(2)}</span>
            <span className="text-gray-400">x + </span>
            <span className="text-blue-400">{regression.intercept.toFixed(1)}</span>
          </div>
          <div className="font-mono text-sm">
            <span className="text-gray-400">R² = </span>
            <span className={regression.rSquared > 0.3 ? 'text-green-400' : 'text-yellow-400'}>
              {regression.rSquared.toFixed(3)}
            </span>
            <span className="text-gray-400 ml-2">r = </span>
            <span className={regression.correlation > 0 ? 'text-green-400' : 'text-red-400'}>
              {regression.correlation.toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div className={`mb-3 p-2 rounded-lg ${
        relationshipHealth.status === 'inverse' ? 'bg-red-900/30 border border-red-700' :
        relationshipHealth.status === 'healthy' ? 'bg-green-900/30 border border-green-700' :
        'bg-yellow-900/30 border border-yellow-700'
      }`}>
        <p className={`text-sm font-medium ${relationshipHealth.color}`}>
          {relationshipHealth.status === 'inverse' ? '⚠️ ' :
           relationshipHealth.status === 'healthy' ? '✅ ' : '📊 '}
          {relationshipHealth.message}
        </p>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              dataKey="aiAdoption"
              name="AI Adoption"
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
            >
              <Label
                value="AI Adoption (%)"
                position="bottom"
                offset={0}
                style={{ fill: '#9ca3af', fontSize: 12 }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="wellbeing"
              name="Wellbeing"
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
            >
              <Label
                value="Wellbeing (0-100)"
                angle={-90}
                position="left"
                offset={10}
                style={{ fill: '#9ca3af', fontSize: 12 }}
              />
            </YAxis>
            <ZAxis type="number" dataKey="population" range={[30, 200]} />
            <Tooltip content={<CustomTooltip />} />

            {/* Scatter points by archetype */}
            {Object.entries(archetypeData).map(([archetype, data]) => (
              <Scatter
                key={archetype}
                name={archetypeLabels[archetype] || archetype}
                data={data}
                fill={archetypeColors[archetype] || '#6b7280'}
                fillOpacity={0.7}
                isAnimationActive={false}
              />
            ))}

            {/* Regression line */}
            {regressionLineData.length === 2 && (
              <ReferenceLine
                segment={[
                  { x: regressionLineData[0].x, y: regressionLineData[0].y },
                  { x: regressionLineData[1].x, y: regressionLineData[1].y }
                ]}
                stroke={regression.slope >= 0 ? '#22c55e' : '#ef4444'}
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            )}

            {/* Reference line at wellbeing = 50 (neutral) */}
            <ReferenceLine
              y={50}
              stroke="#6b7280"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />

            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => <span className="text-gray-300 text-xs">{value}</span>}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="bg-gray-700/50 rounded p-2">
          <div className="text-gray-400">Countries</div>
          <div className="text-white font-bold">{dataPoints.length}</div>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <div className="text-gray-400">Avg AI Adoption</div>
          <div className="text-blue-400 font-bold">
            {(dataPoints.reduce((s, p) => s + p.aiAdoption, 0) / dataPoints.length).toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <div className="text-gray-400">Avg Wellbeing</div>
          <div className="text-green-400 font-bold">
            {(dataPoints.reduce((s, p) => s + p.wellbeing, 0) / dataPoints.length).toFixed(1)}
          </div>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <div className="text-gray-400">Slope Direction</div>
          <div className={`font-bold ${regression.slope >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {regression.slope >= 0 ? '↗ Positive' : '↘ Negative'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WellbeingScatterPlot;
