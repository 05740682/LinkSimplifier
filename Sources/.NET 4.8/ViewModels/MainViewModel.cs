using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;

namespace LinkSimplifier
{
    public class MainViewModel : ViewModelBase
    {
        private string _inputUrl;
        private string _resultText;
        private bool _isDownloading;
        private bool _showDownloadPanel;
        private double _progressValue;
        private string _downloadedSize = "0 B";
        private string _totalSize = "0 B";
        private CancellationTokenSource _cts;

        // 属性：输入URL
        public string InputUrl
        {
            get => _inputUrl;
            set => SetField(ref _inputUrl, value);
        }

        // 属性：结果文本
        public string ResultText
        {
            get => _resultText;
            set => SetField(ref _resultText, value);
        }

        // 属性：是否正在下载
        public bool IsDownloading
        {
            get => _isDownloading;
            set
            {
                if (SetField(ref _isDownloading, value))
                {
                    // 当 IsDownloading 变化时，通知 DownloadButtonText 也变化了
                    OnPropertyChanged(nameof(DownloadButtonText));
                }
            }
        }

        // 属性：是否显示下载面板
        public bool ShowDownloadPanel
        {
            get => _showDownloadPanel;
            set => SetField(ref _showDownloadPanel, value);
        }

        // 属性：进度值
        public double ProgressValue
        {
            get => _progressValue;
            set => SetField(ref _progressValue, value);
        }

        // 属性：已下载大小
        public string DownloadedSize
        {
            get => _downloadedSize;
            set => SetField(ref _downloadedSize, value);
        }

        // 属性：总大小
        public string TotalSize
        {
            get => _totalSize;
            set => SetField(ref _totalSize, value);
        }

        // 计算属性：下载按钮文本
        public string DownloadButtonText => IsDownloading ? "取消下载" : "下载文件";

        // 命令：解析URL
        public ICommand ParseCommand { get; }

        // 命令：下载文件
        public ICommand DownloadCommand { get; }

        // 命令：清空
        public ICommand ClearCommand { get; }

        public MainViewModel()
        {
            // 初始化命令 - 所有按钮默认可点击
            ParseCommand = new RelayCommand(async _ => await ParseUrlAsync());

            DownloadCommand = new RelayCommand(async _ => await DownloadFileAsync());

            ClearCommand = new RelayCommand(_ => ClearAll());
        }

        // 解析URL的方法
        private async Task ParseUrlAsync()
        {
            try
            {
                ResultText = "正在分析Url...";
                var result = await UrlProcessor.ProcessUrlAsync(InputUrl);
                ResultText = result;
            }
            catch (Exception ex)
            {
                ResultText = $"解析失败: {ex.Message}";
            }
        }

        // 下载文件的方法
        private async Task DownloadFileAsync()
        {
            if (IsDownloading)
            {
                // 取消下载
                _cts?.Cancel();
                return;
            }

            // 点击后检查结果文本是否为有效的URL
            if (string.IsNullOrWhiteSpace(ResultText))
            {
                MessageBox.Show("请先点击【开始解析】按钮获取下载地址", "警告",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (!Globals.HttpProtocolRegex.IsMatch(ResultText))
            {
                MessageBox.Show("解析结果不是有效的下载地址", "警告",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            // 开始下载
            IsDownloading = true;
            ShowDownloadPanel = true;
            _cts = new CancellationTokenSource();

            try
            {
                var progress = new Progress<(double Percentage, long BytesRead, long? TotalBytes)>(p =>
                {
                    ProgressValue = p.Percentage;
                    DownloadedSize = FileSizeUtils.FormatBytes(p.BytesRead);
                    TotalSize = p.TotalBytes.HasValue ?
                        FileSizeUtils.FormatBytes(p.TotalBytes.Value) : "未知";
                });

                string tempDir = Globals.Paths[1];
                bool success = await Downloader.DownloadFileAsync(
                    ResultText, tempDir, progress, _cts.Token);

                if (success)
                {
                    Application.Current.Dispatcher.Invoke(() =>
                    {
                        MessageBox.Show("下载完成！", "提示",
                            MessageBoxButton.OK, MessageBoxImage.Information);
                    });
                }
            }
            catch (OperationCanceledException)
            {
                // 用户取消了下载，不显示错误
                Application.Current.Dispatcher.Invoke(() =>
                {
                    MessageBox.Show("下载已取消", "提示",
                        MessageBoxButton.OK, MessageBoxImage.Information);
                });
            }
            catch (Exception ex)
            {
                Application.Current.Dispatcher.Invoke(() =>
                {
                    MessageBox.Show($"下载出错: {ex.Message}", "错误",
                        MessageBoxButton.OK, MessageBoxImage.Error);
                });
            }
            finally
            {
                IsDownloading = false;
                ShowDownloadPanel = false;
                ProgressValue = 0;
                DownloadedSize = "0 B";
                TotalSize = "0 B";
                _cts?.Dispose();
                _cts = null;
            }
        }

        // 清空所有内容
        private void ClearAll()
        {
            InputUrl = string.Empty;
            ResultText = string.Empty;
            ShowDownloadPanel = false;
            ProgressValue = 0;
            DownloadedSize = "0 B";
            TotalSize = "0 B";
        }
    }
}