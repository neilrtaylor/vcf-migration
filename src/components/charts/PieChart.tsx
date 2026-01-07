// Pie chart component
import { Pie } from 'react-chartjs-2';
import { ChartWrapper } from './ChartWrapper';
import { defaultPieOptions, getPieColors } from '@/utils/chartConfig';
import type { ChartOptions } from 'chart.js';

interface DataPoint {
  label: string;
  value: number;
}

interface PieChartProps {
  title?: string;
  subtitle?: string;
  data: DataPoint[];
  height?: number;
  colors?: string[];
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  formatValue?: (value: number) => string;
}

export function PieChart({
  title,
  subtitle,
  data,
  height = 300,
  colors,
  showLegend = true,
  legendPosition = 'right',
  formatValue,
}: PieChartProps) {
  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);
  const pieColors = colors || getPieColors(data.length);

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: pieColors,
        borderWidth: 0,
      },
    ],
  };

  const options: ChartOptions<'pie'> = {
    ...defaultPieOptions,
    plugins: {
      ...defaultPieOptions.plugins,
      legend: {
        display: showLegend,
        position: legendPosition,
        labels: {
          color: '#525252',
          padding: 12,
          usePointStyle: true,
          pointStyle: 'rect',
        },
      },
      tooltip: {
        ...defaultPieOptions.plugins?.tooltip,
        callbacks: formatValue
          ? {
              label: (context) => {
                const value = context.raw as number;
                const label = context.label || '';
                return `${label}: ${formatValue(value)}`;
              },
            }
          : undefined,
      },
    },
  };

  return (
    <ChartWrapper title={title} subtitle={subtitle} height={height}>
      <Pie data={chartData} options={options} />
    </ChartWrapper>
  );
}
