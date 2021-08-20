using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ChatApp_Windows
{
    public partial class MainForm : Form
    {
        public MainForm()
        {
            InitializeComponent();

            browser.Load("http://192.168.10.39:24024/");
        }

        private void browser_MouseDown(object sender, MouseEventArgs e)
        {
            Console.WriteLine(e.Location);
        }
    }
}
