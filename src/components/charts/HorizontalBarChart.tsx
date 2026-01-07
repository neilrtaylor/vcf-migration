// Horizontal bar chart component
import { Bar } from 'react-chartjs-2';
import { ChartWrapper } from './ChartWrapper';
import { defaultBarOptions, getBarColors } from '@/utils/chartConfig';
import type { ChartOptions } from 'chart.js';

interface DataPoint {
  label: string;
  value: number;
}

interface HorizontalBarChartProps {
  title?: string;
  subtitle?: string;
  data: DataPoint[];
  height?: number;
  valueLabel?: string;
  showLegend?: boolean;
  colors?: string[];
  formatValue?: (value: number) => string;
}

export function HorizontalBarChart({
  title,
  subtitle,
  data,
  height = 300,
  valueLabel = 'Value',
  showLegend = false,
  colors,
  formatValue,
}: HorizontalBarChartProps) {
  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);
  const barColors = colors || getBarColors(data.length);

  const chartData = {
    labels,
    datasets: [
      {
        label: valueLabel,
        data: values,
        backgroundColor: barColors,
        borderWidth: 0,
        borderRadius: 2,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    ...defaultBarOptions,
    plugins: {
      ...defaultBarOptions.plugins,
      legend: {
        display: showLegend,
      },
      tooltip: {
        ...defaultBarOptions.plugins?.tooltip,
        callbacks: formatValue
          ? {
              label: (context) => {
                const value = context.raw as number;
                return `${valueLabel}: ${formatValue(value)}`;
              },
            }
          : undefined,
      },
    },
  };

  return (
    <ChartWrapper title={title} subtitle={subtitle} height={height}>
      <Bar data={chartData} options={options} />
    </ChartWrapper>
  );
}
