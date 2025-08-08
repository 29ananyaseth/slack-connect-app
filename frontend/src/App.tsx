import React, { useState, useEffect } from "react";
import axios from "axios";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert, { AlertColor } from "@mui/material/Alert";
import {
  Button, TextField, Typography, Box, List, ListItem, ListItemText, IconButton, CircularProgress, Paper
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import Logo from './sms-logo.svg'; 

const BACKEND_URL = "https://slaek-connect-app-29ananyaseth.onrender.com";




function App() {
  const [channel, setChannel] = useState("#social");
  const [text, setText] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(false);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<AlertColor>("success");

  const showSnackbar = (msg: string, severity: AlertColor = "success") => {
    setSnackbarMsg(msg);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };
  const handleSnackbarClose = () => setSnackbarOpen(false);

  // Fetch scheduled messages
  const fetchScheduled = async () => {
    setScheduledLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/slack/scheduled-messages`);
      setScheduled(res.data);
    } catch (err: any) {
      showSnackbar("Failed to load scheduled messages", "error");
    } finally {
      setScheduledLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduled();
    // eslint-disable-next-line
  }, []);

  // Send message now
  const handleSend = async () => {
    setLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/slack/send-message`, { channel, text });
      showSnackbar("Message sent!", "success");
      setText("");
      fetchScheduled();
    } catch (err: any) {
      showSnackbar("Failed: " + (err?.response?.data?.error || err.message), "error");
    } finally {
      setLoading(false);
    }
  };

  // Schedule message
  const handleSchedule = async () => {
    setLoading(true);
    try {
      const sendAt = date?.toISOString();
      await axios.post(`${BACKEND_URL}/slack/schedule-message`, { channel, text, sendAt });
      showSnackbar("Message scheduled!", "success");
      setText("");
      fetchScheduled();
    } catch (err: any) {
      showSnackbar("Failed: " + (err?.response?.data?.error || err.message), "error");
    } finally {
      setLoading(false);
    }
  };

  // Cancel scheduled message
  const handleCancel = async (id: string) => {
    try {
      await axios.delete(`${BACKEND_URL}/slack/scheduled-message/${id}`);
      showSnackbar("Scheduled message canceled.", "info");
      setScheduled((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      showSnackbar("Failed to cancel: " + (err?.response?.data?.error || err.message), "error");
    }
  };

  // Slack OAuth
  const handleOAuth = () => {
    window.location.href = `${BACKEND_URL}/auth/slack`;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        sx={{
          minHeight: "100vh",
          width: "100vw",
          bgcolor: "linear-gradient(135deg, #f5ecd7 0%, #dfc8b6 100%)",
          background: "linear-gradient(120deg, #f9f6f2 0%, #e3d5ca 50%, #b08968 100%)",
          py: { xs: 4, md: 8 },
          px: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Paper
          elevation={4}
          sx={{
            p: { xs: 3, sm: 4 },
            maxWidth: 425,
            width: "100%",
            bgcolor: "rgba(255,255,255,0.92)",
            borderRadius: 4,
            boxShadow: "0 8px 32px 0 rgba(138, 110, 79, 0.1)",
            border: "1.5px solid #dbc1ac",
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <img src={Logo} alt="App logo" width={48} height={48}
              style={{ borderRadius: 12, background: "#f3e4d5", boxShadow: "0 2px 8px #cbb09233" }} />
          </Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" color="#6f4e37">
            Slack Message Scheduler
          </Typography>
          <Typography variant="subtitle1" color="#ad8560" sx={{ mb: 3 }}>
            Schedule or send messages to your Slack channel easily.
          </Typography>
          <Button
            variant="contained"
            fullWidth
            sx={{
              mb: 3,
              background: "linear-gradient(90deg,#a87950,#b99272)",
              fontWeight: 600,
              color: "#fff",
              "&:hover": { background: "linear-gradient(90deg,#8c6742,#a87950)" }
            }}
            onClick={handleOAuth}
          >
            Connect with Slack
          </Button>

          <TextField
            fullWidth
            label="Channel (e.g., #general)"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            sx={{ mb: 2 }}
          />

          <DateTimePicker
            label="Schedule Time (optional)"
            value={date}
            onChange={setDate}
            slotProps={{
              textField: {
                fullWidth: true,
                sx: { mb: 2 },
              },
            }}
          />

          <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
            <Button
              variant="contained"
              color="success"
              onClick={handleSend}
              disabled={loading || !channel || !text}
              sx={{
                background: "linear-gradient(90deg,#92715c,#c3a17a)",
                color: "#fff",
                fontWeight: 600,
                "&:hover": { background: "linear-gradient(90deg,#836149,#b08968)" }
              }}
            >
              Send Now
            </Button>
            <Button
              variant="outlined"
              color="info"
              onClick={handleSchedule}
              disabled={loading || !channel || !text || !date}
              sx={{
                borderColor: "#b08968",
                color: "#7d5a3a",
                fontWeight: 600,
                "&:hover": { borderColor: "#a87950", background: "#f9f6f2" }
              }}
            >
              Schedule
            </Button>
          </Box>

          {/* Scheduled Messages Section */}
          <Typography variant="h6" sx={{ mt: 4, mb: 1, color: "#7c5830", fontWeight: 600 }}>
            Scheduled Messages
            <IconButton
              size="small"
              onClick={fetchScheduled}
              sx={{ ml: 1, color: "#b08968" }}
              disabled={scheduledLoading}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Typography>
          {scheduledLoading ? (
            <CircularProgress size={24} sx={{ display: "block", mx: "auto", my: 2, color: "#b08968" }} />
          ) : (
            <List>
              {scheduled.length === 0 && (
                <ListItem>
                  <ListItemText primary="No scheduled messages." />
                </ListItem>
              )}
              {scheduled.map((m) => (
                <ListItem
                  key={m.id}
                  sx={{
                    borderBottom: "1px solid #ebd8c3",
                    bgcolor: m.sent ? "#f6e7d8" : "#fff"
                  }}
                  secondaryAction={
                    !m.sent && (
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleCancel(m.id)}
                        sx={{ color: "#9b6e44" }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )
                  }
                >
                  <ListItemText
                    primary={
                      <span style={{ color: m.sent ? "#bbb" : "#6f4e37" }}>
                        <b>[{m.channel}]</b> {m.text}
                      </span>
                    }
                    secondary={
                      <span style={{ color: m.sent ? "#bca488" : "#b08968" }}>
                        {m.sent
                          ? `Sent at: ${new Date(m.sendAt).toLocaleString()}`
                          : `Scheduled for: ${new Date(m.sendAt).toLocaleString()}`}
                      </span>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}

          {/* Snackbar notifications */}
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={3000}
            onClose={handleSnackbarClose}
          >
            <MuiAlert
              onClose={handleSnackbarClose}
              severity={snackbarSeverity}
              elevation={6}
              variant="filled"
              sx={{ background: snackbarSeverity === "success" ? "#a87950" : undefined }}
            >
              {snackbarMsg}
            </MuiAlert>
          </Snackbar>
          <Typography variant="body2" align="center" color="#b08968" sx={{ mt: 4, opacity: 0.75 }}>
            Made  by <b>Ananya Seth</b>
          </Typography>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
}

export default App;
