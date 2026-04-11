using LinkSimplifier.Common;
using LinkSimplifier.Services;
using LinkSimplifier.Services.Network;
using LinkSimplifier.Utils;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;

namespace LinkSimplifier
{
    public partial class MainWindow : Window, INotifyPropertyChanged
    {
        private string _inputUrl, _resultText, _downloadedSize = "0 B", _totalSize = "0 B";
        private bool _isDownloading, _showDownloadPanel;
        private double _progressValue;
        private CancellationTokenSource _cts;

        public string InputUrl { get => _inputUrl; set => SetField(ref _inputUrl, value); }
        public string ResultText { get => _resultText; set => SetField(ref _resultText, value); }
        public bool IsDownloading { get => _isDownloading; set { if (SetField(ref _isDownloading, value)) OnPropertyChanged(nameof(DownloadButtonText)); } }
        public string DownloadButtonText => IsDownloading ? "取消下载" : "下载文件";
        public bool ShowDownloadPanel { get => _showDownloadPanel; set => SetField(ref _showDownloadPanel, value); }
        public double ProgressValue { get => _progressValue; set => SetField(ref _progressValue, value); }
        public string DownloadedSize { get => _downloadedSize; set => SetField(ref _downloadedSize, value); }
        public string TotalSize { get => _totalSize; set => SetField(ref _totalSize, value); }

        public ICommand ParseCommand { get; }
        public ICommand DownloadCommand { get; }
        public ICommand ClearCommand { get; }

        public MainWindow()
        {
            InitializeComponent();
            DataContext = this;

            ParseCommand = new RelayCommand(async _ => {
                try
                {
                    string msg = "正在分析Url...";
                    DebugLogger.Write(msg, 2);
                    ResultText = msg;

                    var result = await UrlProcessor.ProcessUrlAsync(InputUrl);
                    ResultText = result;
                    DebugLogger.Write("解析完成", 2);
                }
                catch (Exception ex)
                {
                    string errorMsg = $"解析失败: {ex.Message}";
                    DebugLogger.Write($"{errorMsg}\n{ex.ToString()}", 4);
                    ResultText = errorMsg;
                }
            });

            DownloadCommand = new RelayCommand(async _ => await DownloadFileAsync());

            ClearCommand = new RelayCommand(_ => {
                DebugLogger.Write("已清空所有内容", 2);
                InputUrl = string.Empty;
                ResultText = string.Empty;
                ShowDownloadPanel = false;
                ProgressValue = 0;
                DownloadedSize = "0 B";
                TotalSize = "0 B";
            });

            Closed += (s, e) => { _cts?.Cancel(); _cts?.Dispose(); };
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
                DebugLogger.Write(warn, 2);
                MessageBox.Show(warn, "警告", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (!RegexPatterns.HttpProtocolRegex.IsMatch(ResultText))
            {
                string warn = "解析结果不是有效的下载地址";
                DebugLogger.Write(warn, 2);
                MessageBox.Show(warn, "警告", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            IsDownloading = true;
            ShowDownloadPanel = true;
            _cts = new CancellationTokenSource();

            try
            {
                DebugLogger.Write($"开始下载文件: {ResultText}", 2);
                var progress = new Progress<(double Percentage, long BytesRead, long? TotalBytes)>(p => {
                    ProgressValue = p.Percentage;
                    DownloadedSize = FileSizeUtils.FormatBytes(p.BytesRead);
                    TotalSize = p.TotalBytes.HasValue ? FileSizeUtils.FormatBytes(p.TotalBytes.Value) : "未知";
                });

                string tempDir = AppConfig.BaseDirectory;
                if (await Downloader.DownloadFileAsync(ResultText, tempDir, progress, _cts.Token))
                {
                    string info = "下载完成！";
                    DebugLogger.Write(info, 2);
                    MessageBox.Show(info, "提示", MessageBoxButton.OK, MessageBoxImage.Information);
                }
            }
            catch (OperationCanceledException)
            {
                string info = "下载已取消";
                DebugLogger.Write(info, 2);
                MessageBox.Show(info, "提示", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                string error = $"下载出错: {ex.Message}";
                DebugLogger.Write($"{error}\n{ex.ToString()}", 4);
                MessageBox.Show(error, "错误", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                IsDownloading = ShowDownloadPanel = false;
                ProgressValue = 0;
                DownloadedSize = "0 B";
                TotalSize = "0 B";
                _cts?.Dispose(); _cts = null;
            }
        }

        public event PropertyChangedEventHandler PropertyChanged;
        protected void OnPropertyChanged([CallerMemberName] string p = null) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(p));
        protected bool SetField<T>(ref T f, T v, [CallerMemberName] string p = null)
        {
            if (EqualityComparer<T>.Default.Equals(f, v)) return false;
            f = v; OnPropertyChanged(p); return true;
        }
    }
}