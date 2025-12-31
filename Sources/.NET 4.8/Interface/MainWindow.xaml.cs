using System;
using System.Threading;
using System.Windows;

namespace LinkSimplifier
{
    /// <summary>
    /// MainWindow.xaml 的交互逻辑
    /// </summary>
    public partial class MainWindow : Window
    {
        internal MainWindow()
        {
            InitializeComponent();
        }

        private void Window_ContentRendered(object sender, EventArgs e)
        {
            string test = "";
            Url_TextBox.Text = test;
        }

        private async void Parser_Button_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                Result_TextBox.Text = "正在分析Url...";
                Result_TextBox.Text = await UrlProcessor.ProcessUrlAsync(Url_TextBox.Text);
            }
            catch (Exception ex)
            {
                Result_TextBox.Text = $"解析失败: {ex.Message}";
            }
            finally
            {
                Result_TextBox.ScrollToEnd();
            }
        }

        private CancellationTokenSource _cts;
        private string _originalButtonText;
        private async void Download_Button_Click(object sender, RoutedEventArgs e)
        {
            if (Download_Button.Content.ToString() == "取消下载")
            {
                _cts?.Cancel();
                return;
            }

            if (string.IsNullOrWhiteSpace(Result_TextBox.Text) || !Globals.HttpProtocolRegex.IsMatch(Result_TextBox.Text))
            {
                MessageBox.Show("请先点击【开始解析】按钮转换为直接下载地址", "警告", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            _originalButtonText = Download_Button.Content.ToString();
            Download_Button.Content = "取消下载";
            SetDownloadPanelState(true);
            _cts = new CancellationTokenSource();

            try
            {
                string url = Result_TextBox.Text;
                string tempDir = Globals.Paths[1];

                var progress = new Progress<(double Percentage, long BytesRead, long? TotalBytes)>(p =>
                {
                    ProgressBar.Value = p.Percentage;
                    DownloadedSizeRun.Text = FileSizeUtils.FormatBytes(p.BytesRead);
                    TotalSizeRun.Text = FileSizeUtils.FormatBytes(p.TotalBytes.Value);
                });

                bool success = await Downloader.DownloadFileAsync(url, tempDir, progress, _cts.Token);
                if (success) MessageBox.Show("下载完成！", "提示");
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                MessageBox.Show($"下载出错: {ex.Message}", "错误", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                Download_Button.Content = _originalButtonText;
                SetDownloadPanelState(false);
                _cts?.Dispose();
                _cts = null;
            }
        }

        private void Clear_Button_Click(object sender, RoutedEventArgs e)
        {
            Url_TextBox.Clear();
            Result_TextBox.Clear();
        }

        private void SetDownloadPanelState(bool isVisible)
        {
            ResultBorder.Margin = isVisible ? new Thickness(0, 0, 0, 16) : new Thickness(0);
            DownloadPanel.Visibility = isVisible ? Visibility.Visible : Visibility.Collapsed;
            Height = isVisible ? 600 : 550;
        }
    }
}
