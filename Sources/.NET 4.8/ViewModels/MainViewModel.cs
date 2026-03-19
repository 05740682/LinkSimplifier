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

        public string InputUrl
        {
            get => _inputUrl;
            set => SetField(ref _inputUrl, value);
        }

        public string ResultText
        {
            get => _resultText;
            set => SetField(ref _resultText, value);
        }

        public bool IsDownloading
        {
            get => _isDownloading;
            set
            {
                if (SetField(ref _isDownloading, value))
                {
                    OnPropertyChanged(nameof(DownloadButtonText));
                }
            }
        }

        public bool ShowDownloadPanel
        {
            get => _showDownloadPanel;
            set => SetField(ref _showDownloadPanel, value);
        }

        public double ProgressValue
        {
            get => _progressValue;
            set => SetField(ref _progressValue, value);
        }

        public string DownloadedSize
        {
            get => _downloadedSize;
            set => SetField(ref _downloadedSize, value);
        }

        public string TotalSize
        {
            get => _totalSize;
            set => SetField(ref _totalSize, value);
        }

        public string DownloadButtonText => IsDownloading ? "取消下载" : "下载文件";

        public ICommand ParseCommand { get; }
        public ICommand DownloadCommand { get; }
        public ICommand ClearCommand { get; }

        public MainViewModel()
        {
            ParseCommand = new RelayCommand(async _ => await ParseUrlAsync());
            DownloadCommand = new RelayCommand(async _ => await DownloadFileAsync());
            ClearCommand = new RelayCommand(_ => ClearAll());
        }

        private async Task ParseUrlAsync()
        {
            try
            {
                string msg = "正在分析Url...";
                DebugLogger.Write(msg,2);
                ResultText = msg;

                var result = await UrlProcessor.ProcessUrlAsync(InputUrl);
                ResultText = result;
                DebugLogger.Write("解析完成",2);
            }
            catch (Exception ex)
            {
                string errorMsg = $"解析失败: {ex.Message}";
                DebugLogger.Write($"{errorMsg}\n{ex.ToString()}", 4);
                ResultText = errorMsg;
            }
        }

        private async Task DownloadFileAsync()
        {
            if (IsDownloading)
            {
                DebugLogger.Write("取消下载", 2);
                _cts?.Cancel();
                return;
            }

            if (string.IsNullOrWhiteSpace(ResultText))
            {
                string warn = "请先点击【开始解析】按钮获取下载地址";
                DebugLogger.Write(warn,2);
                MessageBox.Show(warn, "警告", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (!Globals.HttpProtocolRegex.IsMatch(ResultText))
            {
                string warn = "解析结果不是有效的下载地址";
                DebugLogger.Write(warn,2);
                MessageBox.Show(warn, "警告", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            IsDownloading = true;
            ShowDownloadPanel = true;
            _cts = new CancellationTokenSource();

            try
            {
                DebugLogger.Write($"开始下载文件: {ResultText}", 2);
                var progress = new Progress<(double Percentage, long BytesRead, long? TotalBytes)>(p =>
                {
                    ProgressValue = p.Percentage;
                    DownloadedSize = FileSizeUtils.FormatBytes(p.BytesRead);
                    TotalSize = p.TotalBytes.HasValue ? FileSizeUtils.FormatBytes(p.TotalBytes.Value) : "未知";
                });

                string tempDir = Globals.Paths[1];
                bool success = await Downloader.DownloadFileAsync(ResultText, tempDir, progress, _cts.Token);

                if (success)
                {
                    string info = "下载完成！";
                    DebugLogger.Write(info, 2);
                    Application.Current.Dispatcher.Invoke(() =>
                    {
                        MessageBox.Show(info, "提示", MessageBoxButton.OK, MessageBoxImage.Information);
                    });
                }
            }
            catch (OperationCanceledException)
            {
                string info = "下载已取消";
                DebugLogger.Write(info, 2);
                Application.Current.Dispatcher.Invoke(() =>
                {
                    MessageBox.Show(info, "提示", MessageBoxButton.OK, MessageBoxImage.Information);
                });
            }
            catch (Exception ex)
            {
                string error = $"下载出错: {ex.Message}";
                DebugLogger.Write($"{error}\n{ex.ToString()}", 4);
                Application.Current.Dispatcher.Invoke(() =>
                {
                    MessageBox.Show(error, "错误", MessageBoxButton.OK, MessageBoxImage.Error);
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

        private void ClearAll()
        {
            DebugLogger.Write("已清空所有内容", 2);
            InputUrl = string.Empty;
            ResultText = string.Empty;
            ShowDownloadPanel = false;
            ProgressValue = 0;
            DownloadedSize = "0 B";
            TotalSize = "0 B";
        }
    }
}