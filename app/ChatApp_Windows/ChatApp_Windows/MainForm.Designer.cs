
namespace ChatApp_Windows
{
    partial class MainForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.browser = new CefSharp.WinForms.ChromiumWebBrowser();
            this.SuspendLayout();
            // 
            // browser
            // 
            this.browser.ActivateBrowserOnCreation = false;
            this.browser.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
// TODO: Code generation for '' failed because of Exception 'Invalid Primitive Type: System.IntPtr. Consider using CodeObjectCreateExpression.'.
            this.browser.Location = new System.Drawing.Point(5, 5);
            this.browser.Name = "browser";
            this.browser.Size = new System.Drawing.Size(790, 490);
            this.browser.TabIndex = 0;
            this.browser.MouseDown += new System.Windows.Forms.MouseEventHandler(this.browser_MouseDown);
            // 
            // MainForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(26)))), ((int)(((byte)(26)))), ((int)(((byte)(32)))));
            this.ClientSize = new System.Drawing.Size(800, 500);
            this.Controls.Add(this.browser);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
            this.MinimumSize = new System.Drawing.Size(320, 500);
            this.Name = "MainForm";
            this.Text = "ChatApp";
            this.MouseDown += new System.Windows.Forms.MouseEventHandler(this.browser_MouseDown);
            this.ResumeLayout(false);

        }

        #endregion

        private CefSharp.WinForms.ChromiumWebBrowser browser;
    }
}

